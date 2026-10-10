# Scope and phase dependencies

## Source documents

The implementation was reviewed against both user-supplied plans in full:

| Document | SHA-256 of the supplied file |
| --- | --- |
| `appflow-product-plan-fa(1).md` | `847524fb8c5a96ac5684f671dce0d36341403525849e894ae352c1ec5015f68a` |
| `AppFlow-Implementation-Plan-FA(1).md` | `8a0c11194d5558570737a42bc0a58f6629d743adf616656efcff8aabc0c2fb28` |

Their Phase 1 scopes agree. Later numbering and scheduling differ; the table below
preserves both references rather than silently treating them as identical. Product
requirement IDs such as `P1-07` refer to the first document. `I1-1` in the acceptance
record means requirement 1 of implementation-plan Phase 1. This English roadmap
records implementation scope; it does not replace or reduce the attached requirements.

## Product invariants

- Show application behavior from a business overview down into reusable subprocesses.
  Do not substitute an agent-activity log, a directory tree, or one huge flat graph.
- The user's existing coding agent generates and maintains repository-owned maps
  after finishing code changes. No separate paid AI API, agent password, or API key.
  Extra work can consume existing agent quota; infrastructure has separate costs.
- Connecting GitHub alone does not generate a map. Unpublished session files and
  unobservable agent progress must never appear as available or in progress.
- The viewer is read-only in the first version. Code and map updates are made by
  the agent in the user's branch/PR, preserving unrelated definitions and instructions.
- One map covers one repository. Multiple independent connected projects are allowed;
  authorization and cached content remain isolated per project and user.
- Every viewed map, subprocess, and source reference belongs to the selected immutable
  revision. Branch, PR, comparison base, retrieval time, and review time are distinct.
- A private map requires both application repository access and the viewer's current
  authorization. Installation or possession of a URL is insufficient. Revocation must
  stop later retrieval, including caches; already downloaded data cannot be recalled.
- Hosted daily use is browser-based; contributor tooling and self-hosting setup do
  not become terminal requirements for ordinary hosted users.
- Structural validity, semantic accuracy, coverage, freshness, and successful runtime
  execution are separate claims. Warnings and recovery paths must remain explicit.
- English is mandatory for project-owned content. User map text remains Unicode-capable.

## Dependency cross-reference

| Product plan phase | Implementation plan phase | Required predecessors and retained scope |
| --- | --- | --- |
| 0 — Scope and reference scenarios | 0 | No predecessor. Define users, roles, business flows, before/after examples, public fixture, and owner-approved private pilot. |
| 1 — Content and maintenance contract | 1 | Phase 0 scope. Stable identities, conditions, outcomes, sources, uncertainty, reusable children, arbitrary depth, format versioning, and async/external boundaries. Implemented in this change. |
| 2 — Sample-data viewer | 2 | Phase 1. Overview, drill-down, detail panel separate from navigation, breadcrumbs/back/browser history, search with location, deep links, zoom/pan/fit, path highlighting, stable layout, responsive and multilingual text, accessible non-color statuses, and empty/error states. |
| 3 — Existing-agent generation and updates | 4 and 5 (agent portions) | Product phases 1 and 2. Initial inspection, saved non-destructive rules, targeted dependent updates, deletion/rename/no-op review, same-branch output, recovery prompts, failure disclosure, and a fresh agent-session trial. Product plan gates integration expansion on this proof. |
| 4 — Authorized GitHub connection | 3 | Sample viewer and content rules; respect the product plan's agent-proof gate before expanding integrations. Read-only selected repositories, personal/organization cases, separate login and repository permission, per-user access, informative safe errors, and effective revocation/disconnect. |
| 5 — Complete browser onboarding | 4 (site portions) | Product phases 3 and 4. Authorized project list, selectable base branch, no-map setup prompt using chosen language, branch/PR preview before merge, recheck/retry, resumable setup, honest publication/progress state, and idempotent setup preserving existing maps. |
| 6 — Versions and freshness | 5 (review tracking) and 6 | Product phase 5. Immutable snapshots, explicit code/map review status, change-bound no-op receipts, manual refresh, separately labelled last valid fallback, duplicate/late-event protection, and branch isolation without update loops. |
| 7 — PR preview and comparison | 6 | Product phase 6. Authorized PR selection, explicit base/head revisions, added/changed/deleted conditions and identities, inspectable previous state, links to changes, missing-map warnings, and actual base-branch reload after merge; closing without merge changes nothing. No automatic GitHub comments required. |
| 8 — Quality and failure handling | 7 and 9 (scale/UX) | Product phases 6 and 7; basic validation starts in Phase 1. Actionable malformed/missing/version/source diagnostics, truthful degraded sections, no deletion on connection errors, larger sample navigation, and measured performance. |
| 9 — Privacy and data control | 8 | Product phases 4–8; authorization is mandatory at connection time. Tenant/cache/search/deep-link isolation, safe untrusted text/links, no execution of repository code, protected credentials, data minimization/retention, disconnect/deletion that preserves GitHub files, organization-role changes, shared-browser logout, and honest host access statements. |
| 10 — Real end-to-end trials | 9 | Product phases 0–9. Public and approved private repositories; startup, feature, bug fix, delete/rename, no-op, forgotten/failed map, new agent session, concurrent PRs, merge/close, revocation, and provider outage trials. Independent user comprehension and recorded pass/fail/not-run evidence. |
| 11 — Open-source release | 10 | All required trials resolved. Chosen license, user/contributor/security guidance, public safe demo, exact tested agent environment, compatibility/migration notes, independent self-hosting, portability, and honest costs/status. |

The implementation plan lists GitHub connection before initial agent generation;
the product plan proves agent generation before expanding integrations. No decision
about that later sequencing is hidden in this Phase 1 change. Before Phase 3 work,
reconcile the scheduling with the owner while retaining both capability sets. Phase 2
is the agreed next scope in both documents. Security and quality apply throughout.

For later scale testing, retain **both** plans' criteria: at least 10 overview
processes and 200 nodes overall, plus a process with more than 30 internal steps,
shared children, retry loops, and multiple levels. These are test fixtures, not
product size ceilings. Desktop is primary; small screens must retain usable
navigation and details.

## Phase 0 decisions needed for Phase 1

The target user is a developer or product owner working with a repository-capable
web coding agent. The user requests work; the agent edits code and maps; GitHub
stores versions; the site will display maps and assess only what it can verify.
The synthetic reference application covers existing-project setup, adding discounts,
and a sign-in bug fix, along with multi-step chat behavior. Its content is safe for
public review. No private user repository was copied or chosen without permission.

The plans intend the initial supported agent route to be a Claude web environment
that can actually read repositories and publish branch/PR changes. This repository
does not claim ordinary chat has that capability, or that any Claude/Codex route
has been tested. Agent-neutral data is implemented; cloud integration certification
remains future work. The private-pilot selection and independent comprehension trial
are open acceptance gates, not silently completed prerequisites.

## Outside the initial release

Multi-repository aggregate maps, live execution monitoring, live agent-typing analysis,
editing application logic through a diagram, sending tasks directly to agents,
automatic PR comments or other GitHub writes, public sharing of private maps, and
full historical reconstruction are not first-release commitments. Building a separate
coding agent, charging for AI credits, adding an AI analysis API to the viewer, or
building billing are outside the agreed architecture. Other agent environments
require their own end-to-end trials before official support is claimed.
