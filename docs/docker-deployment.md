# Docker deployment

This setup runs one CodeVista process with persistent SQLite, Nginx and automatic
Let's Encrypt certificates. No database server, Redis or source checkout is needed
on the server. It supports ARM64 (including the requested Ubuntu aarch64 server)
and AMD64. It is a deployment implementation, not evidence of a live hosting trial.

## 1. Publish an image

After merging the deployment PR into `master`:

1. Create the **public** Docker Hub repository `iamseyedalipro/codevista`.
2. Create a Docker Hub access token with read/write access to that repository.
3. In GitHub repository Settings → Secrets and variables → Actions, add the
   repository secret `DOCKERHUB_TOKEN`. Never put it in source or your server `.env`.
4. Open Actions → **Build and publish Docker image** → Run workflow → `master`.
5. Wait for success. Copy `iamseyedalipro/codevista@sha256:...` from its summary.

The publishing workflow is manual only and accepts only `master`. It runs checks,
builds both architectures, adds SBOM/provenance, and pushes `latest`, `sha-<commit>`
and `build-<run>-<attempt>`. Jobs serialize publication. Action references are
commit-pinned. No SSH, server credentials, or server deployment is involved.
The existing verification workflow continues running on PRs and master pushes.
Digest references are immutable; tags can be overwritten, including on reruns.
Dependency/base-image updates should be rebuilt, reviewed and redeployed regularly.

## 2. Prepare DNS and the server

Requirements: Docker Engine and Compose **2.23.1+** (inline config support), a
public server, free TCP ports 80/443, and outbound HTTPS to Docker Hub, GitHub and
Let's Encrypt. ARM64 images are selected automatically; do not force AMD64.

Point `codevista.duckdns.org` to your server's public IPv4 using DuckDNS. Only set
an IPv6 record if IPv6 actually reaches this server. Allow inbound 80 and 443 in
both provider and host firewalls. Keep port 80 open for certificate renewal.
Do not expose port 3000. DNS configuration remains your responsibility; this
Compose setup configures Nginx, not DNS. A static server IP needs no DDNS updater.

```sh
docker version
docker compose version
getent ahosts codevista.duckdns.org
sudo ss -ltnp 'sport = :80 or sport = :443'
mkdir -p ~/codevista
cd ~/codevista
```

Download `compose.yaml` and `deploy/.env.example` from the **same reviewed commit**
as the published image (replace COMMIT_SHA with its full Git commit):

```sh
curl --fail --location https://raw.githubusercontent.com/iamseyedalipro/CodeVista/COMMIT_SHA/compose.yaml -o compose.yaml
curl --fail --location https://raw.githubusercontent.com/iamseyedalipro/CodeVista/COMMIT_SHA/deploy/.env.example -o .env
chmod 600 .env
openssl rand -base64 32
nano .env
```

Set `DOMAIN=codevista.duckdns.org`, your real `LETSENCRYPT_EMAIL`, the image digest
from the workflow as `CODEVISTA_IMAGE`, and the generated key as
`SESSION_ENCRYPTION_KEY`. Keep this key unchanged across restarts and upgrades.
Back it up securely, separately from database backups. Do not publish `.env` or
paste the output of `docker compose config` into tickets: it contains secrets.

## 3. Configure GitHub sign-in

Create a **GitHub App** under your GitHub developer settings:

| Setting | Value |
| --- | --- |
| Homepage | `https://codevista.duckdns.org` |
| Callback | `https://codevista.duckdns.org/auth/callback` |
| Expiring user access tokens | Enabled |
| Repository Contents | Read-only |
| Repository Pull requests | Read-only |
| Webhooks | Disabled |

Fill `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_CLIENT_ID` and
`GITHUB_CLIENT_SECRET` in `.env`. The app uses user access tokens; a GitHub App
private key is not required. Allow the intended users to install the app, then
install it for selected repositories. See [self-hosting](self-hosting.md) for
organization approval, access boundaries and acceptance checks.

Leaving **all four** GitHub variables empty runs only the public demo. That does
not enable connected repository access. The encryption key is still required.

## 4. Start

```sh
docker compose config --quiet
docker compose pull
docker compose up -d --wait --wait-timeout 120
docker compose ps
docker compose logs --tail=80 acme
```

Nginx discovers the application hostname. The ACME companion obtains a certificate
and configures renewal and Nginx reloads. It can take several minutes after the
containers start. `up --wait` verifies application health/container startup, **not**
certificate issuance or GitHub availability. Open:

**https://codevista.duckdns.org**

```sh
curl --fail https://codevista.duckdns.org/healthz
```

Expect `{"status":"ok"}`. Verify login, installation discovery, a real repository
map, and account logout. Initial certificate failures usually mean incorrect
A/AAAA records, blocked port 80, DNS propagation or CA rate limits. Read ACME logs;
do not repeatedly delete certificate/account volumes or repeatedly force issuance.
HTTPS is required for login; do not work around certificate failures with HTTP.

The application has a read-only root filesystem, non-root user, dropped
capabilities, no host port, bounded logs and persistent data volume. Only Nginx
publishes ports. Proxy access logs and per-vhost error logs are disabled so OAuth
callback query strings cannot enter normal request logs. This limits diagnostics;
use health checks and certificate logs instead of enabling private request logs.

**Host trust:** nginx-proxy and acme-companion mount the Docker socket for service
discovery and Nginx reloads. A read-only socket mount does not make Docker API calls
read-only: compromise of these infrastructure containers can compromise the host.
Use this on a dedicated trusted host, keep these images patched and do not give
untrusted users Docker access. The CodeVista container has no socket mount.
Upstream images are version-tagged; operators may pin tested multi-platform digests
for stricter supply-chain reproducibility.

## 5. Update and roll back

Run the manual workflow again. Save your current image digest, then set the new
`CODEVISTA_IMAGE` in `.env`:

```sh
docker compose config --quiet
docker compose pull app
docker compose up -d --no-deps --wait --wait-timeout 120 app
curl --fail https://codevista.duckdns.org/healthz
```

No `down` is needed. There is brief single-instance downtime during replacement;
this is not a zero-downtime deployment. A failed health check returns an error but
does not automatically roll back. Restore the previous digest in `.env` and run
the same commands. Review migration compatibility before rolling back future
versions. Never run `docker compose down -v` on a host with data you want to keep.
A failed unhealthy process is not automatically restarted merely because of its
health status; process exits are restarted by the restart policy. Monitor HTTPS
health and certificate expiry externally.

To update the proxy/ACME containers, review and edit their pinned versions, then
run `docker compose pull` and `docker compose up -d --wait`. To change the domain,
update DNS, `DOMAIN`, and the GitHub App homepage/callback, then recreate services.
Old browser sessions belong to the old origin and users must sign in again.

## 6. Backup and restore

Back up the encryption key separately. For a consistent cold SQLite backup,
stop the app and include the whole data directory (including any WAL files).
Run from the deployment directory:

```sh
mkdir -p backups
chmod 700 backups
docker compose stop app
BACKUP_FILE="backups/codevista-$(date -u +%Y%m%dT%H%M%SZ).tar"
(umask 077; docker compose run --rm --no-deps -T --entrypoint tar app -C /app/data -cf - . > "$BACKUP_FILE")
docker compose start app
```

Check command success and test the archive before relying on it. Restart the app
even if backup fails. Encrypt and copy backups off-server; set a retention policy.
Also preserve the certificates and `acme-state` volumes through your host backup
system to avoid unnecessary reissuance after disaster recovery.

To restore an archive, stop the app, preserve its current volume as a fallback,
then empty the data volume and restore the chosen backup. These commands **replace
all current application data**; set `BACKUP_FILE` to the reviewed archive first:

```sh
docker compose stop app
docker compose run --rm --no-deps -T --entrypoint sh app -c 'find /app/data -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +'
docker compose run --rm --no-deps -T --entrypoint tar app -C /app/data -xf - < "$BACKUP_FILE"
docker compose up -d --wait app
```

Restore the matching encryption key in `.env` before starting. Keep Compose's
project name `codevista` stable: changing it creates differently named volumes.
Run one application instance per SQLite volume. Proxy clients share the current
application's peer-IP rate limits; see [self-hosting](self-hosting.md) before
planning a larger public installation.
