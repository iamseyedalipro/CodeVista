# Phase 1 acceptance record

## Implementation status

The content-contract implementation is complete for review. The automated acceptance
checks below pass locally. The independent human comprehension criterion has not
been run, so the entire phase is **not declared unconditionally accepted**. This
distinction also applies to the Phase 0 owner-approved private pilot, which remains
unselected and is not needed to exercise the portable contract locally.

Repository baseline: `master` at initial commit
`22f5f70` contained only `README.md`; there was no application, stack, test suite,
agent instruction file, or existing map to preserve. Work uses a feature branch.
The repository name remains CodeVista; LogicAtlas is the requested working name.

## Requirement traceability

| Product requirement | Implementation requirement | Implementation and evidence |
| --- | --- | --- |
| P1-01 — Meaningful business overview | I1-2 | Manifest roots and optional explained relationships; independent login/payment/chat; relationship validation and reference walkthroughs. |
| P1-02 — Unbounded conceptual hierarchy | I1-5 | Reusable process IDs; iterative traversal; reference Payment → Discount → Eligibility → Subscription and a 600-level automated hierarchy test. |
| P1-03 — Clear stages, relationships, sources | I1-2, I1-8 | Required purpose, title, description, evidence and edges; source symbols in an included executable fixture; explicit unspecified-source alternatives. |
| P1-04 — Start/end/decisions and branch conditions | I1-3 | Node kinds, entry and terminal invariants, branch conditions, unique branch text, dangling/unreachable checks, and negative tests. |
| P1-05 — Real success/error/cancel/wait/retry | I1-4, I1-13 | Login retries/cancellation, payment pending/timeout/verification/cancellation/zero price, and background chat; executable before/after scenario tests. |
| P1-06 — Shared process references | I1-6 | One Subscription definition used by Chat and Discount Eligibility; missing-child checks and shared-child tests. |
| P1-07 — Stable identity on rename | I1-1 | Process/node/edge identity independent of titles, canonical ID-based filenames, rename regression tests, and unchanged-file comparisons. |
| P1-08 — Real loops without recursive hierarchy | I1-7 | Valid retry/wait edges; direct/indirect containment-cycle rejection; no recursive depth traversal. |
| P1-09 — Implemented/inferred/planned separation | I1-9 | Separate behavior/evidence fields, warnings and explicit reasons; planned process isolated from current paths. |
| P1-10 — Explicit unknowns and gaps | I1-9 | Scope and gaps required; unknown placeholder contains no invented steps; partial-map coverage cannot be marked complete. |
| P1-11 — Multiple source paths in one repository | I1-8 | Reference arrays scoped to one repository; safe relative paths and commit-pinned link builder; no per-reference repository override. |
| P1-12 — Portable content independent of UI | I1-10 | Published strict JSON Schemas, plain JSON documents, English format/authoring docs; no layout, agent-provider, or hosted-service dependency. |
| Cross-cutting language support | I1-11 | English project-owned content; Unicode-preserving validation tested with escaped mixed-language input; actual rendering waits for Phase 2. |
| Cross-cutting compatibility | I1-12 | Exact schema version gating; unsupported formats fail with an explicit migration action; no destructive or silent migration. |
| Cross-cutting async/external boundary | I1-13 | Separate external and wait kinds; queuing versus completion in chat; provider internals explicitly outside the reviewed scope. |

## Acceptance checklist

| Criterion | Result |
| --- | --- |
| Sample contains a condition, error path, retry loop, and shared subprocess | Pass — fixture structure and scenario tests |
| At least three levels; no hard-coded depth of three | Pass — reference sample plus 600-level test |
| Renaming a process keeps its relationships | Pass — IDs, edges, and subprocess references preserved |
| Unknown behavior can be represented without inventing explanations | Pass — unreviewed Usage reporting placeholder |
| Each important step has source evidence or a clear missing-source reason | Pass — required evidence and fixture source/symbol checks |
| Rules are understandable and agent-neutral | Rules provided; no external agent environment has been certified |
| All three reference scenarios can express their important branches | Pass — before/after documents, fixture behavior tests, and walkthroughs |
| A person other than the author explains paths and branch reasons without code | **Not run** — independent reviewer needed; prompts and expected explanations are documented |

## Verification commands

```sh
npm ci
npm run check
git diff --check
```

Initial local verification used Node.js 24.19.0 and TypeScript 5.9.3. The suite has
69 tests covering format compatibility, graph rules, identity preservation, shared
children, deep hierarchy, unknown/planned states, behavior changes, source references,
read-only operation, malformed UTF-8/JSON, resource limits, path traversal, symlinks,
and CLI exit codes. Both reference bundles validate with expected warnings.
The workflow runs the same checks on Node.js 22 and 24; a configured workflow is not
itself evidence that a remote run has passed.

`npm audit --audit-level=low` reported **0 vulnerabilities** after upgrading Ajv to
8.20.0. `git diff --check` passed. These are results of this implementation session,
not a guarantee against future dependency advisories.

## Limitations and next work

- No viewer, browser navigation, multilingual rendering, GitHub login/authorization,
  private-repository access, cache, webhook, branch/PR comparison, or deployed site.
- No agent onboarding integration, automatic updates, freshness receipt, migration
  implementation, or tested Claude/Codex cloud workflow. The rules are a contract,
  not evidence of universal agent compliance.
- Structural checks cannot prove narrative accuracy, source existence in arbitrary
  repositories, exhaustive conditions, retry safety, or privacy of a future viewer.
  Included fixture sources are checked separately by tests.
- The local file reader expects a stable caller-provided checkout; it does not offer
  an atomic Git snapshot under concurrent filesystem mutation.
- Private pilot selection, independent comprehension review, release licensing,
  private security-reporting channel, and hosting documentation remain open gates.
- Phase 2 is next after review: the interactive sample-data viewer. No later phase
  has been started or represented as completed by this implementation.
