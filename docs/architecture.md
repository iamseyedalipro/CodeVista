# Architecture and trust boundaries

## Components

The pure TypeScript contract validates untrusted manifest/process values against
bundled schemas and semantic graph rules. The local reader adds filesystem safety
and byte limits. Neither component executes repository code or compiles schemas
supplied by a repository.

The React viewer owns positions, viewport, navigation, and search. Flow files
contain semantic content and stable identities, not UI coordinates. React Flow
renders one process at a time; Dagre creates its initial layout. Positions for
unchanged IDs survive small refreshes within a branch; new IDs are placed without
moving established nodes. Switching repositories/branches separates layout state.
The map graph is not a directory tree or an agent activity log.

Fastify serves the built client, agent kit, and API from one origin. SQLite stores
encrypted sessions and account preferences. The GitHub adapter uses fixed GitHub
API/OAuth hosts, bounded response readers, redirect rejection, and request timeouts.
Application code does not accept arbitrary outbound URLs.

## Authorization

A random opaque cookie identifies a server-side session; only its SHA-256 digest
is stored as the session lookup key. Cookies are HttpOnly and SameSite=Lax. HTTPS
hosts use Secure cookies with the `__Host-` prefix. OAuth uses one-use state bound
to a separate browser nonce, plus PKCE. Session and preference payloads use
AES-256-GCM with a persistent host key and a fresh nonce for every write.

User access tokens represent the intersection of GitHub App permissions and the
viewer's permissions. Each private read also checks the repository against active
installations of **this app** accessible to that user. Suspended installations and
unselected repositories are excluded. A repository ID in a URL, saved preference,
or cache key is not authorization. Fork comparisons authorize the fork separately.

Mutations require the exact configured Origin and a session-specific CSRF token.
They only change this host's session/preferences, never GitHub files. Account
deletion removes all of the user's sessions. Disconnect persists across sessions,
and can remove a previously visited project after GitHub access has been revoked.
Disconnect deletes its saved branch preference but retains an encrypted repository-ID
tombstone until reconnect or account deletion, preventing automatic reconnection
when other preferences expire.

Private responses use `Cache-Control: no-store, private`. Every snapshot request
reauthorizes before reading a previous valid map. Responses also check that the
session still exists and the project remains connected after asynchronous loading.
Cache writes use request sequence checks; disconnect/logout invalidates pending
writes. Provider errors do not return private cached content.

The browser stores no private map data in localStorage, sessionStorage, IndexedDB,
or a service worker. Search uses only the authorized in-memory map. Navigation
reauthorizes, and visible pages refresh every minute. Hiding the tab clears the
private viewer; returning rechecks the session. Sign-out broadcasts to other tabs.
Already downloaded data cannot be recalled from screenshots, developer tools,
browser internals, or a malicious client; revocation controls subsequent retrieval.

## Snapshot consistency and freshness

Resolve a selected branch to an immutable commit once, then fetch that commit's
tree and map blob objects. Never mix files from separately resolved branch heads.
Git tree metadata verifies reference-file existence; the app does not fetch source
file bodies to validate symbols or line numbers. Source evidence is an inspectable
claim, not a verified source badge.

A review receipt binds two digests:

- Source digest: sorted Git entries outside `.logicatlas/`, including path, mode,
  object type, and object ID. Submodules are included by commit ID.
- Map digest: canonical manifest plus process values ordered by stable process ID.

A no-flow-change receipt is bound to exactly the same data as an update receipt.
Changes to source or map content invalidate the recorded review. Receipt-only and
map-tool-only commits do not cause endless source review loops. Malformed receipts
warn; they do not turn valid maps into verified ones. Review timestamps are claims,
not server-observed agent activity. There is no polling of the coding agent.

Pull requests load the GitHub-reported base/head commits independently and compare
stable process, node, edge, and relationship IDs. Moves preserve identity. Conditions
are edge fields, so condition changes are visible. Removed items retain inspectable
previous content and locations. An invalid/missing side suppresses comparison rather
than treating all absent content as deleted. A closed PR does not alter the selected
branch; a merged PR updates that branch only when its actual new head is loaded.

## Failure handling

Malformed manifests, unsupported versions, repository mismatches, ambiguous global
graph errors, and truncated trees prevent a normal map view. Identifiable local
process failures may be replaced **in the returned view only** with explicit
unreviewed placeholders. Safe independent processes remain visible. The original
files are never rewritten. Planned/current boundary validation remains enforced.

After a newer invalid map, a previously valid map from the same session, repository,
and branch may be returned. Its displayed commit remains the old commit, the
selected commit is shown separately, and freshness explicitly says it is not
current. No fallback crosses a branch or session. Missing manifests show setup.
Outages, rate limits, and permission failures are errors, not deletions or successful
refreshes. Requests have bounded concurrency and decoded-byte budgets.

## Limits and privacy

| Resource                          | Limit / behavior                                                                 |
| --------------------------------- | -------------------------------------------------------------------------------- |
| Map JSON document                 | 2 MiB                                                                            |
| Total map documents               | 16 MiB                                                                           |
| Recursive GitHub tree response    | 24 MiB; truncated trees rejected                                                 |
| Contract                          | 1,000 processes; 100,000 nodes and 200,000 edges total                           |
| Diagram rendering                 | 500 steps per process; larger processes retain search/details and a bounded list |
| Search results                    | First 250 matches with an explicit count and refinement prompt                   |
| Selected repositories             | Fewer than 2,000 per viewer                                                      |
| Previous valid maps               | Up to 20 entries / 64 MiB per server, at most 15 minutes                         |
| Sessions / pending OAuth attempts | Up to 10,000 each; expiry and periodic cleanup                                   |
| Snapshot concurrency              | Four requests per session, sixteen per server                                    |

Server memory includes tree metadata during requests. Only map JSON is retained
for fallback; source file bodies are not fetched or stored. API tokens never reach
the client. The application disables request logging; host operators must also
sanitize or disable reverse-proxy logs and backups. There is no telemetry, third-party
analytics script, or AI service. Provider/API traffic still goes to GitHub.

Repository-authored content is plain React text, never raw HTML. Source links are
constructed from authorized repository metadata and an immutable SHA, with safe
literal paths. The Content Security Policy permits only same-origin scripts and
connections. Inline styles are required by the diagram library; inline scripts,
objects, and framing are blocked.

## Supported deployment boundary

This implementation targets one server process with a private SQLite volume behind
HTTPS. Distributed deployments, webhooks, arbitrary GitHub Enterprise hosts, and
large public multi-tenant service operations are not implemented. Large graphs
should use meaningful subprocesses. Automated tests do not certify GitHub provider
behavior, semantic accuracy of generated maps, or human usability.
