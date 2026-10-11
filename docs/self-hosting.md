# Self-hosting

CodeVista runs independently with your own host, database, and GitHub App. It does
not contact a central CodeVista service. The static sample viewer works without
GitHub configuration. Live GitHub App provisioning and a separate operator trial
are not yet certified; record their results in the acceptance report before release.

For containers, see the [Docker deployment guide](docker-deployment.md).

## Build and run

Use a maintained Node.js 22.13+ or 24 installation and npm. Node's built-in SQLite
API is used; some supported Node versions print an experimental API warning.

```sh
npm ci
npm run build
npm start
```

The server binds to `127.0.0.1:3000` by default. `/healthz` reports process health,
not GitHub availability. Run one server process per SQLite database. The current
release does not implement distributed sessions, shared caches, or multi-instance
rate limiting. Scale out only after introducing and testing those components.

Use a process supervisor with automatic restart. Keep the working directory at
the repository root so `web-dist` is found. Build artifacts include the standalone
agent ZIP. Do not serve the repository directory, database directory, or environment
file as static content; only `web-dist` is public.

## Register a GitHub App

Create an app that you control in GitHub developer settings:

- Set the homepage to your public HTTPS origin.
- Set the callback URL to `https://YOUR_HOST/auth/callback`.
- Enable expiring user access tokens. This implementation uses GitHub App **user
  access tokens**, OAuth state and PKCE; it does not use installation private keys.
- Request **Contents: read-only** and **Pull requests: read-only** repository
  permissions. Metadata read access is implicit. No write permissions, user email
  permission, webhook secret, AI credentials, or OAuth `repo` scope are needed.
- Disable webhooks for this implementation. Map updates use explicit refresh or version selection.
  Visible-page polling checks access only; it does not reload maps.
- Allow installation only on the repositories the owner selects. For organization
  installations, follow the organization's owner approval and SSO policies.
- Generate a client secret and record the app ID, client ID, and app slug.

GitHub permissions cover repository content, not just `.codevista`. The server
chooses to read tree metadata and map documents; explain this distinction to users.
Fork pull requests require explicit access to both repositories, including app
installation on the fork. The server does not widen permissions to read a fork.

Authoritative protocol references:
[GitHub App user authorization](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-with-a-github-app-on-behalf-of-a-user),
[user token refresh](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/refreshing-user-access-tokens),
and [user installations](https://docs.github.com/en/rest/apps/installations#list-app-installations-accessible-to-the-user-access-token).

## Configure the host

Copy `.env.example` to an untracked `.env` file and fill in the values. Generate a
persistent encryption key, store it in your secret manager, and never commit it:

```sh
openssl rand -base64 32
```

Start with Node's environment-file support:

```sh
node --env-file=.env dist/server/main.js
```

| Variable                 | Meaning                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------- |
| `NODE_ENV`               | `production` requires an HTTPS origin and persistent encryption key                |
| `APP_ORIGIN`             | Exact browser origin, without a path; used for callbacks and CSRF checks           |
| `PORT`                   | Internal listener port; default 3000                                               |
| `LISTEN_HOST`            | Bind address; default 127.0.0.1; set 0.0.0.0 only in an isolated container/network |
| `DATABASE_PATH`          | Persistent SQLite file; default `data/codevista.sqlite`                           |
| `SESSION_ENCRYPTION_KEY` | Exactly 32 random bytes, base64 encoded                                            |
| `GITHUB_APP_ID`          | Numeric ID of this host's GitHub App                                               |
| `GITHUB_APP_SLUG`        | App URL slug, such as `your-flow-viewer`                                           |
| `GITHUB_CLIENT_ID`       | App client ID                                                                      |
| `GITHUB_CLIENT_SECRET`   | App client secret, server only                                                     |

All four GitHub settings are required together. Without GitHub settings, local
demo mode creates an ephemeral encryption key. Do not use ephemeral keys for a
persistent configured host. Rotating the key invalidates existing sessions and
preferences; users must sign in again. Remove the old database according to your
retention policy when intentionally resetting the host.

Terminate HTTPS at a trusted reverse proxy. Forward requests to the loopback
listener; preserve the original `Origin` header. Do not cache `/api`, `/auth`, or
private responses. Never log query strings on `/auth/callback`, request cookies,
authorization headers, response bodies, or private map content. Disable such logs
in the reverse proxy as well as the application.

The application intentionally does not trust forwarded IP headers. Its safety
limits use the direct peer IP: 30 auth requests/minute, 300 API requests/minute,
plus four simultaneous snapshot/comparison requests per session and sixteen per
server. Behind a single proxy, clients share its IP budget. Configure additional
edge protection and capacity-test your intended workload; do not claim large
multi-tenant deployment readiness from the synthetic fixture.

## Persistence, deletion, and backups

Use a private persistent directory. The application creates directories with mode
0700 and the SQLite file with mode 0600. Restrict access to the directory so SQLite
WAL files and backups are also protected. Sessions expire after eight hours;
branch preferences after 30 days without a settings update. Minimal disconnected
repository IDs remain encrypted until reconnection or account deletion, so expiry
does not silently reconnect a project.
Cleanup runs once a minute. OAuth attempts expire after ten minutes.

Tokens and preferences use AES-256-GCM encryption. Keep the key separate from
backups. Account deletion removes active records and sessions, but cannot erase
operator backups or guarantee forensic erasure from storage media. Publish your
backup retention/deletion policy. There is no database of repository source code.
Previously valid map JSON is retained only in bounded process memory for at most
15 minutes; restarting clears it.

Before admitting private data, run the real two-account revocation, organization,
logout, browser-history, and account-deletion trials in `docs/acceptance.md`.
Configure a private security reporting channel and an incident-response owner.

## Portability

Map files, schemas, and maintenance instructions remain in the user's repository.
Disconnecting, deleting an account, or shutting down the host never changes those
files. Install a different host's app, grant selected access, and open the same
branch. No export from a proprietary database is required. Review receipts do not
contain host-specific identifiers.
