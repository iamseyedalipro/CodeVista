# Migrate an existing installation to CodeVista

The product's former working name was LogicAtlas (sometimes written AtlasLogic).
This rename changes the canonical map directory from `.logicatlas` to `.codevista`,
kit URL to `/agent/codevista-kit.zip`, schema URNs to `urn:codevista:*`, default
SQLite path to `data/codevista.sqlite`, and browser session cookie/event names.
This is an explicit migration; the new reader does not silently load old paths.
JSON field shapes and `schemaVersion: 1.0.0` are unchanged. Stable project, process,
node and edge IDs must remain unchanged, even if an ID contains an old name.

## Application repositories

1. Work on a clean branch. If `.codevista` already exists, inspect both folders and
   merge deliberately; do not overwrite either map.
2. Rename the old directory with `git mv .logicatlas .codevista`.
3. Obtain the **new host's** agent kit. Refresh tools, schemas, FORMAT.md and
   MAINTENANCE.md, preserving manifest/process definitions and stable IDs. Old
   bundled tools still target the old directory and cannot create a new receipt.
4. Replace the old maintenance block in your actual agent instruction file with
   the new block. Preserve unrelated instructions. Update any CI scripts, custom
   schema registrations, kit links and `.logicatlas` path references you own.
5. Validate using `node .codevista/tools/validate.mjs .codevista`.
6. Commit the migration, regenerate the receipt with
   `node .codevista/tools/review.mjs --result updated --note "CodeVista path migration"`,
   commit the receipt, and publish the branch. Refresh the new viewer on that branch.

Old historical branches/PRs containing only the old directory need their own
migration before this version can display them. Keep the old host release available
if historical comparison is required during rollout. Do not rename IDs to improve
branding: identity continuity matters more than display names.

## Hosts

Stop the old service and back up its SQLite database, encryption key and configuration.
Keep `DATABASE_PATH` explicitly pointing to your **existing** database (its filename
need not change); keep the exact same encryption key. Alternatively, move the database
only while the service is stopped, including any WAL/SHM companions, and update
`DATABASE_PATH`. Never start against an unintended empty default database.

Build the new release and restart. Browser cookie names changed, so users sign in
again. Existing encrypted records remain under the normal retention policy. Do not
operate old and new server versions simultaneously on one SQLite file. Update reverse
proxy/service names if desired; existing GitHub App credentials and callback URL
remain valid when the public origin is unchanged. Old kit download URLs are replaced.
