#!/usr/bin/env bash
# Run the production image with the same filesystem restrictions as Compose.
set -euo pipefail
image="${1:?Usage: test-container.sh IMAGE}"
name="codevista-smoke-${RANDOM}-$$"
volume="${name}-data"
cleanup() {
  docker rm -f "$name" >/dev/null 2>&1 || true
  docker volume rm "$volume" >/dev/null 2>&1 || true
}
trap cleanup EXIT
export SESSION_ENCRYPTION_KEY
SESSION_ENCRYPTION_KEY="$(openssl rand -base64 32)"
docker volume create "$volume" >/dev/null
docker run -d --name "$name" --read-only --cap-drop ALL \
  --security-opt no-new-privileges:true --tmpfs /tmp:size=64m \
  -e SESSION_ENCRYPTION_KEY -e APP_ORIGIN=https://codevista.example.com \
  -v "$volume:/app/data" "$image" >/dev/null
wait_for_health() {
  for attempt in $(seq 1 60); do
    if docker exec "$name" node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"; then
      return 0
    fi
    sleep 1
  done
  docker logs "$name"
  return 1
}
wait_for_health
docker exec "$name" node --input-type=module -e '
import { access, writeFile } from "node:fs/promises";
if (process.getuid() === 0) throw new Error("Container must not run as root");
for (const path of ["/", "/agent/codevista-kit.zip"]) {
  const response = await fetch(`http://127.0.0.1:3000${path}`);
  if (!response.ok || (await response.arrayBuffer()).byteLength === 0) throw new Error(path);
}
await access("/app/data/codevista.sqlite");
await writeFile("/app/data/smoke-marker", "persistent");
'
docker restart "$name" >/dev/null
wait_for_health
docker exec "$name" node --input-type=module -e '
import { readFile } from "node:fs/promises";
if (await readFile("/app/data/smoke-marker", "utf8") !== "persistent") throw new Error("Data lost on restart");
'
printf 'Container smoke test passed.\n'
