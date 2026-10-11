# CodeVista repository flows

The actual CodeVista application map is in `.logicatlas/manifest.json`. The
`examples/reference` maps remain synthetic examples; this map documents the
implemented host, browser viewer, validation library and existing-agent handoff.
All map content is English. Stable IDs identify behavior rather than filenames.

The initial map was inspected against the default `master` source on 2026-10-11.
It covers all implemented product entry points under `server/`, `web/` and `src/`
within the declared behavioral scope. Shared authorization, validation, reading,
comparison and review processes have one definition used by their callers.

## Process index

| Process ID | Title | Placement |
| --- | --- | --- |
| `github-sign-in` | Sign in with GitHub | Overview |
| `session-access` | Refresh and validate a session | Shared subprocess |
| `repository-access` | Authorize a repository | Shared subprocess |
| `repository-discovery` | Discover authorized repositories | Shared subprocess |
| `api-request-guard` | Protect API requests | Overview |
| `api-error-response` | Return a safe API error | Shared subprocess |
| `project-workspace` | List and check projects | Overview |
| `project-connections` | Disconnect or reconnect a project | Overview |
| `project-version-selection` | Open a project version | Overview |
| `branch-preference` | Remember the selected branch | Overview |
| `snapshot-loading` | Load a repository map | Shared subprocess |
| `immutable-map-read` | Read and validate an immutable map | Shared subprocess |
| `pull-request-comparison` | Compare a pull request | Overview |
| `flow-comparison` | Compare stable flow identities | Shared subprocess |
| `flow-exploration` | Explore hierarchical application flows | Overview |
| `flow-search` | Find a process or step | Overview |
| `agent-map-setup` | Set up or repair a repository map | Overview |
| `local-map-validation` | Validate a local map | Overview |
| `flow-validation` | Validate the flow contract | Shared subprocess |
| `map-review-recording` | Record an exact map review | Overview |
| `local-map-read` | Read declared local map documents | Shared subprocess |
| `review-freshness` | Assess map review freshness | Shared subprocess |
| `session-and-account-removal` | Sign out or delete host account data | Overview |
| `browser-session-lifecycle` | Keep private browser views tied to current access | Overview |
| `encrypted-host-storage` | Persist and expire host identity data | Overview |
| `public-demo` | Explore the public reference demo | Overview |
| `host-startup` | Start and stop the self-hosted service | Overview |
| `github-provider-request` | Call GitHub safely | Overview |

## Coverage and evidence

Coverage remains **partial**, with explicit manifest and process gaps. GitHub
consent, organization approval/SSO and provider internals are external boundaries.
External agent autonomy, fresh-session compliance and live provider acceptance
are not certified by this map. Static help prose, styling, build/test mechanics
and future roadmap features are outside the declared behavior scope. The map
includes implemented failure, cancellation, waiting and retry paths only; it does
not invent external-provider retries or missing application error handling.

Every process and step supplies inspected repository-relative code references.
The viewer resolves references at the displayed immutable commit. Validation
checks shape and graph rules; an exact review receipt records a content-bound
review claim. Neither is proof of semantic accuracy or unrestricted coverage.

## Local tools and maintenance

No deployed host or kit URL was supplied for this task. Because CodeVista itself
contains the official kit builder, the installed `.logicatlas` kit was built from
this checkout with `npm run build:core` and `npm run build:kit`. The ZIP was
inspected for unsafe paths and symlinks before extraction. It includes the source
version's format, schemas, maintenance rules, standalone tools and license notices;
no guessed deployment address or additional AI API was used.

Existing `AGENTS.md` instructions are preserved, with the maintenance block
appended once. Future tasks should preserve identities and unrelated process files.

```sh
node .logicatlas/tools/validate.mjs .logicatlas
# After committing final source/instructions/map changes:
node .logicatlas/tools/review.mjs --result updated --note 'Describe reviewed behavior'
```

Commit the receipt and publish it with the related map/source changes. A later
change outside `.logicatlas` requires another review, including documentation
changes. The hosted viewer can only load published files from the selected branch;
this initial map is absent on `master` until its PR is merged.
