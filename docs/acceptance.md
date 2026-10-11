# Implementation and acceptance ledger

Recorded on 2026-10-10. This expands the historical
[Phase 1 record](phase-1-acceptance.md) without replacing either supplied plan.
The source hashes and phase crosswalk remain in [roadmap.md](roadmap.md).

**Implementation is not unconditional phase acceptance.** Later-phase code is
available for review, but the external-agent, live private-repository, independent
user, and independent hosting gates are still open. They must be resolved before a
production release or supported-agent claim. No live site was deployed, no PR was
merged, and no real user repository was copied into public fixtures.

## Reproducible automated evidence

Run `npm ci`, `npm run check`, install Playwright Chromium, and run
`npm run test:e2e`. The local execution environment was Node.js 24.19.0,
TypeScript 5.9.3, and managed Chromium headless shell (Playwright cache build 1161).
CI installs the browser matching the locked Playwright version and tests Node 22/24.

The recorded local check run passed **106 unit/integration tests** and **15 browser tests**. The dependency audit reported **zero vulnerabilities** after updating the static-file server and build tooling.

The check suite covers the pure contract, local reader, executable reference
scenarios, standalone agent ZIP, encrypted sessions, OAuth/CSRF, authorization,
revocation, exact receipts, malformed/degraded maps, branch/session isolation,
late responses, fork authorization, PR state, and stable-identity comparison.
Browser checks use the built server and real security headers. GitHub API calls
are mocked: those checks do not certify an installed GitHub App.

The deterministic scale fixture has ten root processes, 413 nodes overall, a
40-node process, a shared child, a retry loop, and three levels. A local browser
run completed overview loading, the 40-node render, and depth-three search in
794 ms. This is one synthetic observation, not a hosted latency guarantee. The
browser check uses a 10-second ceiling for overview and initial process rendering;
validation and search have a two-second ceiling. Actual user/network performance
and human comprehension remain separate trials.

Screenshots of the public overview and selected payment decision were visually
reviewed. The selected decision, outgoing branches, details, and navigation were
readable at desktop width. A 390-pixel browser test checks overflow and usable
details. Screenshots/traces are disposable test artifacts, not private user data.

## Requirement and phase coverage

| Product phase / requirements      | Implemented evidence                                                                                                                                                      | Acceptance status / remaining gate                                                                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 — scope and reference scenarios | Roadmap; synthetic sign-in, discount/payment, chat, unknown/planned areas                                                                                                 | Public fixture implemented; owner-approved private pilot and independent participant NOT RUN                                                                |
| 1 — P1 requirements               | Versioned schemas, types, graph rules, immutable references, before/after scenarios; historical 69-test record                                                            | Automated contract evidence PASS; independent semantic comprehension NOT RUN                                                                                |
| 2 — P2 viewer requirements        | `web/Viewer.tsx`, `FlowCanvas.tsx`, `src/viewer.ts`; overview, relationships, separate details/drill-down, history, exact search, layout, zoom/pan/fit, statuses, mobile  | Automated browser and visual checks PASS; independent payment walkthrough NOT RUN                                                                           |
| 3 — P3-01–13                      | `src/agent.ts`, portable ZIP, additive rules, exact update/no-op receipts, recovery guide; isolated Git/Node workflow tests                                               | Local tools PASS; initial generation and separate change tasks in a fresh Claude web session NOT RUN                                                        |
| 4 — P4-01–10                      | Read-only GitHub App user authorization plus active selected installation; safe private routes, SSO/rate-limit/revocation states; encrypted credentials                   | Mocked API/security checks PASS; real personal/organization installation, two-account and SSO trials NOT RUN                                                |
| 5 — P5-01–10                      | Authorized project statuses, actual branch selection, prompts/language, repeatable setup, publication-only rechecks, saved branch preference                              | Browser/API paths PASS with mocks; independent browser-plus-agent setup NOT RUN                                                                             |
| 6 — P6-01–11                      | Immutable revisions, separate retrieval/review times, exact receipts, explicit fallback commits, concurrency guards, branch isolation, recovery actions                   | Automated version/freshness cases PASS; live provider publication cycle NOT RUN                                                                             |
| 7 — P7-01–11                      | Authorized PR list and fork checks; base/head SHA and branches; proposed/previous views; process/node/edge/condition/relationship diffs, moves/removals; no GitHub writes | Automated stable identity/state/isolation and browser previous-location checks PASS; live merge/retarget/close trial NOT RUN                                |
| 8 — P8-01–10                      | Bounded diagnostics, source existence checks, safe quarantined sections, missing/error distinctions, recent project timestamps, one-process view, scale fixture           | Automated quality/scale PASS; real large-project human review NOT RUN                                                                                       |
| 9 — P9-01–11                      | Data-minimization/retention docs, no AI calls, no repository execution, access-checked caches/search/links, plain text/CSP, disconnect/deletion/logout                    | Automated privacy/security paths PASS; independent security review and live shared-browser/revocation trial NOT RUN                                         |
| 10 — A-01–15                      | Automated analogues below and reproducible live-trial instructions                                                                                                        | Real repository trials NOT RUN; phase NOT ACCEPTED                                                                                                          |
| 11 — P11-01–10                    | MIT license; source demo with before/after comparison; format, user, agent, operator, contributor, security and compatibility docs                                        | Documentation implemented; live setup guide evidence, independent self-hosting trial, private security-channel confirmation, release/tag/deployment NOT RUN |

Implementation-plan phase numbers differ after Phase 2; use the roadmap crosswalk.
No capability has been dropped because its number differs. The larger fixture
meets both plans' test-size requirements. Resource/renderer limits are explicit in
architecture.md; a larger valid process retains searchable step details rather
than freezing the browser.

## Real end-to-end trial ledger

Every entry below is **NOT RUN against a real approved private repository**. The
local analogue is useful evidence, not a substitute for the required trial.

| Scenario                            | Local analogue                                                            | Required live evidence                                                              |
| ----------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| A-01 Private repository without map | Auth tests, missing-map API and onboarding browser case                   | Owner-approved repository; authorized and unauthorized accounts                     |
| A-02 Initial web-agent generation   | Portable-kit test, setup prompt                                           | Actual agent environment/version, initial code inspection, published map commit     |
| A-03 Multi-level navigation         | Browser drill-down/search/history cases                                   | Independent participant describes payment path, error branch, version and gaps      |
| A-04 Feature addition               | Before/after discount behavior and diff tests                             | Separate agent task; affected/dependent process changes; unrelated files preserved  |
| A-05 Conditional bug fix            | Disabled-account regression and condition diff tests                      | Separate agent bug-fix task and matching changed branch condition                   |
| A-06 Delete/rename/move             | Stable identity diff and removed-location browser cases                   | Obsolete behavior removed, callers repaired, rename identity retained               |
| A-07 No-op review                   | Isolated Git source-only change and exact receipt                         | Agent reviews a UI/comment-only task without a fabricated flow edit                 |
| A-08 Forgotten map                  | Source digest mismatch and recovery UI                                    | Publish code without map/review; inspect warning and run recovery prompt            |
| A-09 Broken new map                 | Quarantine/fallback and exact selected/displayed SHA tests                | Publish invalid map after valid map, confirm labeled fallback and repair            |
| A-10 Concurrent PRs                 | Session/branch isolation and late-response checks                         | Two distinct live PR heads plus unchanged base branch                               |
| A-11 Merge                          | Immutable base/head and merged-state API tests                            | Merge an approved fixture PR; return to branch and confirm actual new head          |
| A-12 Close without merge            | Closed-state API and previous-location browser tests                      | Close fixture PR without merging; base remains unchanged                            |
| A-13 Revoke                         | Installation/user revocation, cached-route denial, in-flight logout tests | Revoke real user/app access; next request and copied link expose no private content |
| A-14 GitHub outage                  | Provider-error and no-fallback/no-deletion tests                          | Controlled provider/network failure; retry recovers without false deletion          |
| A-15 Fresh agent session            | Additive saved instructions; portable workflow test                       | New intended-agent session discovers rules; record compliance/failures and recovery |

## How to close the open gates

1. Configure a host-owned GitHub App following `self-hosting.md`. Do not use an
   installation belonging to an unrelated service as proof of this app's access.
2. Obtain owner approval for a private pilot and choose two accounts with different
   permissions. Keep repository names, map contents, logs and credentials out of
   the public acceptance record; use non-sensitive evidence identifiers.
3. In the intended Claude web environment, record product/version/date and actual
   repository read/run/publish capabilities. Complete initial generation, separate
   feature/fix/delete/no-op tasks, and a new-session task. Record failures honestly.
4. Run A-01–15 using immutable commit IDs and expected/observed outcomes. Include
   organization approval/SSO, removed installation access, reconnect, token expiry,
   shared-browser logout/history, and account deletion.
5. Ask someone uninvolved in implementation to complete onboarding and explain a
   branch condition, displayed version, and unreviewed area without reading code.
6. Have a different operator build from the docs with their own host/app. Confirm
   persistence, HTTPS cookies, callback URL, backup retention, and private reporting.
7. Resolve all confidentiality, version-mixing, or misleading-state failures. Only
   then publish a release/tag and supported-agent statement.

## Known limits

- No live GitHub App credentials or owner-approved private pilot were supplied, so
  no installed-provider integration is claimed.
- No Claude web session was invoked. Saved rules cannot guarantee future agent
  compliance, and no agent environment is certified by this change.
- Source links verify file existence at the commit; symbol/line correctness and
  semantic accuracy still require inspection.
- Fallback is process-memory only and expires within 15 minutes. A fresh host with
  no previous valid snapshot cannot manufacture one from repository history.
- Provider failures clear the private view instead of implying fresh authorization.
  Data already downloaded by an authorized viewer cannot be recalled.
- One server/SQLite database is the supported deployment architecture. No distributed
  session/cache/rate-limit implementation or public scale claim is made.
- No GitHub Enterprise hosts, repository code execution, map editing in the viewer,
  automatic PR comments, AI analysis API, billing, or private-map public sharing.

## Repository map generation — 2026-10-11

CodeVista's own application map was created in `.codevista` from inspected
`master` source, with 28 processes and 263 documented nodes. The
[process index](repository-flows.md) records scope, shared definitions and gaps.
The official standalone kit was built from the checked-out kit builder and its
ZIP was inspected before installation. Project instructions were preserved and
the maintenance block was appended once.

`npm run check` passed, including unit/integration tests, web compilation and
reference example validation. The standalone validator passed the new map with
two intentional incomplete-coverage warnings. Every supplied reference path was
checked against the checkout. No application behavior or synthetic reference map
was changed.

`npm run test:e2e` was attempted, but all 15 scenarios stopped at browser launch
because the required Chromium executable was absent. Installing the locked
Playwright headless browser returned an invalid/truncated ZIP, so browser checks
for this task are **BLOCKED**, not passed. Existing historical browser evidence
above is unchanged. No live GitHub App or external-agent acceptance trial was
claimed by this mapping task. An exact source/map review receipt is generated
after committing final instructions and documentation, then committed separately.

## CodeVista branding and theme update — 2026-10-11

- Renamed product-owned runtime identifiers, kit URL, schema URNs and map directory
  to CodeVista / `.codevista`. Existing data requires the explicit migration in
  `docs/migration.md`; stable flow IDs and JSON document shapes are preserved.
- `npm run check`: **106 unit/integration tests passed**, web build and both
  reference-map validations passed. Expected partial/planned evidence warnings remain.
- `npm run test:e2e`: **17 browser tests passed**, including system theme, saved
  overrides, cross-tab synchronization, graph styling and blocked localStorage.
  The matching Playwright browser download failed in this environment. Tests ran
  with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` pointing to a temporary Chromium 153
  binary from `@sparticuz/chromium`; this is not a project dependency. CI still
  installs the browser matching the lockfile.
- The standalone repository map validator passes with its existing coverage gaps;
  the added `panel-theme` process records appearance preference behavior.
- README covers capability-based CLI, IDE and web setup; deployment and migration
  guides are source-reviewed instructions, not evidence of a live deployment.
  No new real-provider, external-agent or independent hosting trial is claimed.

## Docker deployment — 2026-10-11

- Added a multi-stage Node 24 image, production-only installed dependencies,
  non-root runtime, persistent SQLite volume, health check and restricted app
  filesystem/capabilities. Compose adds versioned nginx-proxy/acme-companion for
  domain-driven routing and automated HTTPS issuance/renewal.
- Added a master-only, manually triggered GitHub-hosted build/push workflow for
  public Docker Hub ARM64/AMD64 images, pinned actions, serialized publishing,
  cache, SBOM/provenance, digest summary and a pre-push container smoke gate.
- `npm run check`: **106 tests passed**, web build and reference validation passed.
- `npm run test:e2e`: **17 passed** with temporary Chromium 153 from
  `@sparticuz/chromium`. The matching Playwright browser download failed; this
  temporary fallback is not a project dependency or browser certification.
- Compose 2.39.4 parsed the full file successfully with placeholder configuration;
  YAML parsing, shell syntax and `git diff --check` passed. Standalone map validation
  passed with the existing two partial-coverage warnings.
- Docker Engine is unavailable in the editing environment: image build, container
  smoke, ARM64 execution, actual publication and live ACME issuance remain
  **unverified here**. The manual publication workflow gates pushes on its Docker
  smoke test. No server or GitHub App credentials were accessed and no deployment
  was performed. A real configured GitHub App and hosting trial remain release gates.
- Reviewed existing maps, including host-startup and encrypted-host-storage. No
  application runtime behavior changed; deployment/build infrastructure is outside
  the declared product-map scope. Process IDs and definitions are unchanged;
  a no-flow-change receipt binds this review to the committed source.
