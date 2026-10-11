# Deploy CodeVista so users can view their flowcharts

This guide deploys one CodeVista Node.js server on a Linux VM with systemd, Caddy
HTTPS, persistent SQLite storage and your own GitHub App. Replace `flows.example.com`
with your domain. CodeVista does not require an AI API key: users generate maps with
their existing coding agents and publish them to their repositories.

Status: implementation candidate. Automated tests are not a live GitHub integration
or production certification. Complete the real-user access/revocation trials before
admitting private repositories. See `docs/acceptance.md` and `docs/self-hosting.md`.

## 1. Prepare the host

You need:

- A maintained Linux VM with systemd, Git, npm and Node.js 22.13+ (24 recommended).
- A domain pointing to the VM. Allow inbound TCP 80/443 for HTTPS; restrict SSH to
  your administration network. Do not expose port 3000 or the database publicly.
- Outbound HTTPS access to GitHub/API endpoints and npm during builds.
- A persistent local disk. Run exactly one application process per SQLite database.
- Caddy installed from its official package instructions: https://caddyserver.com/docs/install
- Capacity appropriate to your workload; load-test rather than treating the
  synthetic scale fixture as a production capacity guarantee.

Verify tooling:

```sh
node --version
npm --version
git --version
command -v node
```

The service below assumes Node is `/usr/bin/node`. If `command -v node` returns a
different system-wide path, use that absolute path in `ExecStart`. A root-only nvm
installation will not automatically be available to the service user.

## 2. Check out and build a reviewed release

The commands assume a fresh installation; do not overwrite an existing checkout.

```sh
sudo useradd --system --create-home --home-dir /var/lib/codevista --shell /usr/sbin/nologin codevista
sudo install -d -o codevista -g codevista /opt/codevista
sudo -u codevista git clone https://github.com/iamseyedalipro/CodeVista.git /opt/codevista
cd /opt/codevista
# Select the reviewed commit/tag containing this guide before continuing:
sudo -u codevista git checkout YOUR_REVIEWED_COMMIT_OR_TAG
sudo -u codevista npm ci
sudo -u codevista npm run check
sudo -u codevista npm run build
sudo install -d -m 700 -o codevista -g codevista /var/lib/codevista/data
```

`YOUR_REVIEWED_COMMIT_OR_TAG` is a placeholder, not a published release name.
For this change before merge, use its PR branch or exact reviewed commit. The build
creates `dist`, `web-dist`, and the downloadable kit in `public/agent` (copied into
`web-dist` by Vite). Do not use `npm run dev` as the public production server.

## 3. Register your GitHub App

Open GitHub **Settings → Developer settings → GitHub Apps → New GitHub App**.

| Setting                             | Value                                                                        |
| ----------------------------------- | ---------------------------------------------------------------------------- |
| App name                            | A unique name for your CodeVista host                                        |
| Homepage URL                        | `https://flows.example.com`                                                  |
| User authorization callback URL     | `https://flows.example.com/auth/callback`                                    |
| Expiring user access tokens         | Enabled                                                                      |
| Repository Contents permission      | Read-only                                                                    |
| Repository Pull requests permission | Read-only                                                                    |
| Metadata                            | Implicit read access                                                         |
| Webhooks                            | Disabled; manual map refresh and periodic access checks                                |
| Installation audience               | Any account if serving external users; your account only for a personal host |

Generate a client secret. Record **App ID**, **App slug**, **Client ID**, and
**Client secret**. CodeVista uses GitHub App user authorization with OAuth state and
PKCE; it does not use an installation private key. Do not add write permissions or
OAuth `repo` scope. Repository permissions cover contents broadly; the host chooses
to read map files and tree metadata. Explain that distinction to your users.

Official registration reference:
https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/registering-a-github-app

## 4. Configure secrets and storage

```sh
sudo install -d -m 750 -o root -g codevista /etc/codevista
sudo install -m 640 -o root -g codevista /opt/codevista/.env.example /etc/codevista/codevista.env
openssl rand -base64 32
sudoedit /etc/codevista/codevista.env
```

Put the generated key and your app values in that file. Do not commit or paste them
into tickets, maps, screenshots, or chat:

```dotenv
NODE_ENV=production
APP_ORIGIN=https://flows.example.com
PORT=3000
LISTEN_HOST=127.0.0.1
DATABASE_PATH=/var/lib/codevista/data/codevista.sqlite
SESSION_ENCRYPTION_KEY=YOUR_32_BYTE_BASE64_KEY
GITHUB_APP_ID=YOUR_NUMERIC_APP_ID
GITHUB_APP_SLUG=your-app-slug
GITHUB_CLIENT_ID=YOUR_CLIENT_ID
GITHUB_CLIENT_SECRET=YOUR_CLIENT_SECRET
```

All four GitHub fields must be set together. Keep the encryption key persistent
across restarts and upgrades. Changing it makes existing encrypted sessions and
preferences unusable. `APP_ORIGIN` is exactly the public HTTPS origin, with no path,
query, credentials or fragment. For an existing host, follow `docs/migration.md`
and retain the original database/key explicitly.

## 5. Run under systemd

Create `/etc/systemd/system/codevista.service`:

```ini
[Unit]
Description=CodeVista flowchart viewer
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=codevista
Group=codevista
WorkingDirectory=/opt/codevista
ExecStart=/usr/bin/node --env-file=/etc/codevista/codevista.env /opt/codevista/dist/server/main.js
Restart=on-failure
RestartSec=5
UMask=0077
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=strict
ReadWritePaths=/var/lib/codevista

[Install]
WantedBy=multi-user.target
```

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now codevista
sudo systemctl status codevista --no-pager
curl --fail http://127.0.0.1:3000/healthz
```

`/healthz` checks the process, not GitHub authorization or upstream availability.
If startup fails, inspect `sudo journalctl -u codevista -n 100 --no-pager` locally;
do not publish logs containing sensitive information.

## 6. Enable HTTPS

Merge this site block into `/etc/caddy/Caddyfile`, preserving other hosted sites:

```caddyfile
flows.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

```sh
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
curl --fail https://flows.example.com/healthz
```

Caddy obtains certificates when DNS and ports are correctly configured. Preserve
request `Origin` headers. Do not enable access logs that include callback query
strings, cookies, tokens or response bodies. Do not add CDN/proxy caching to `/api`,
`/auth`, or private responses. Serve the application through this reverse proxy;
never expose the repository, `.env`, data directory or SQLite backups as static files.

The app deliberately does not trust forwarded IP headers. Behind this single proxy,
users share its peer-IP rate budget: 30 auth requests/minute and 300 API requests/minute.
Snapshot/comparison concurrency is also bounded. Monitor 429 responses and test the
expected user load; do not simply disable limits to add capacity.

## 7. Connect a user's repository

1. Visit `https://flows.example.com`, verify the public demo, and open **Projects**.
2. Sign in with GitHub and install your app for selected repositories. Organization
   owners may need to approve installation or SSO access.
3. Open the repository and choose the actual branch.
4. If no map exists, copy the setup prompt and download the agent kit. Give them to
   the user's existing coding agent with read/write access to that same repository.
5. The agent inspects code, creates `.codevista/manifest.json` and process files,
   adds maintenance instructions, validates, commits source/maps, records the review,
   commits the receipt, and pushes its branch or PR.
6. Refresh CodeVista and select that published branch or PR. Open a process card,
   drill into subprocesses, search for steps, and inspect immutable source links.
7. For subsequent code changes, the agent updates affected flows in the same PR.

Users need a browser and an existing repository-capable agent. They do not each
install the CodeVista server. Sharing a viewer URL does not grant repository access:
both the signed-in user's access and the app installation are checked. A fork PR
requires access and installation on both repositories. See README for CLI/IDE/web
agent setup and read-only chat limitations.

## 8. Verify before admitting private projects

- Public demo, guide, theme selection, refresh persistence and mobile layout work.
- GitHub sign-in returns to the exact HTTPS origin; cookies work over HTTPS.
- An authorized user can select an installed repository and load its published map.
- A second account without repository access cannot load that map or a shared deep link.
- Revoking repository/app access prevents subsequent private requests; verify reload
  and background/foreground behavior, not only the initial screen.
- Sign-out/account deletion clear private views; branch/PR selection never falls
  back to another version's map.
- Validate source links and old/new PR comparison on your own test repository.
- Record results in your release acceptance log. Real provider, external-agent and
  independent self-hosting trials remain unverified until you actually run them.

## 9. Backups and retention

The SQLite database contains encrypted sessions/preferences, not a source-code
archive. Treat the database and backups as private. Keep the encryption key backed
up separately with restricted access. Publish a retention/deletion policy.

For a simple consistent backup, stop the only writer and archive the entire private
data directory (including any SQLite companion files):

```sh
sudo install -d -m 700 /var/backups/codevista
sudo systemctl stop codevista
sudo tar -C /var/lib/codevista -czf /var/backups/codevista/data-$(date -u +%Y%m%dT%H%M%SZ).tar.gz data
sudo chmod 600 /var/backups/codevista/*.tar.gz
sudo systemctl start codevista
```

If backup fails, inspect the failure and restart the service; do not leave an
unplanned outage. Test restoration to an isolated host using the matching key.
Never restore a backup over a running database. Account deletion cannot erase
operator backups or guarantee forensic erasure from storage media.

## 10. Upgrade and rollback

Record the running commit with `git -C /opt/codevista rev-parse HEAD`. Back up the
private data and configuration. For a simple single-server maintenance window:

```sh
sudo systemctl stop codevista
cd /opt/codevista
sudo -u codevista git fetch origin
sudo -u codevista git checkout NEW_REVIEWED_COMMIT_OR_TAG
sudo -u codevista npm ci
sudo -u codevista npm run check
sudo -u codevista npm run build
sudo systemctl start codevista
curl --fail https://flows.example.com/healthz
```

Do not continue past a failing command. Restore the previous checkout and rebuild
if validation fails. To roll back, stop the service, check out the recorded previous
commit, run `npm ci` and `npm run build`, and restart with the previous compatible
configuration. Restore database backups only if a release's migration requires it;
check compatibility and stop the writer first. Recheck actual sign-in/map access,
not only health. Never run old/new processes together against the same database.

## Troubleshooting

| Symptom                                 | Check                                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------------------- |
| Demo works, repositories do not         | All four GitHub settings, app installation, user repository access and org approval         |
| Callback/sign-in error                  | Exact callback URL, APP_ORIGIN, HTTPS, current client secret, expiring tokens               |
| Empty/missing map                       | Published branch contains `.codevista/manifest.json`; migrate older folders explicitly      |
| Map still looks old                     | Select the correct branch/PR, push the changes, then refresh                                |
| Review stale or missing                 | Commit final source first, generate receipt with the new kit, then commit/push receipt      |
| SQLite permission/startup error         | Service user owns private writable data directory; Node version supports built-in SQLite    |
| Frequent 429 responses                  | Proxy peer-IP shared budget and workload/concurrency limits                                 |
| Agent cannot install                    | Session needs repository writes, Node and publishing; a read-only connector is insufficient |
| Static host serves HTML but login fails | Deploy the Node backend; a static-only Pages deployment is insufficient                     |

Do not horizontally scale this SQLite/process-local-session architecture without
adding and testing shared persistence, caches and distributed rate limiting.
