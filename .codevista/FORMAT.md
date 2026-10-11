# Flow format 1.0.0

This contract describes application behavior. It does not describe agent activity,
runtime telemetry, or the files and folders of a codebase. JSON Schema defines the
document shape; the semantic validator adds cross-document and graph rules.

## Storage and ownership

Store a map at `.codevista/manifest.json` and one file per process at
`.codevista/processes/<stable-process-id>.json`. The CLI accepts the map directory
as an argument; examples use separate `before` and `after` directories. The manifest
declares all process files. Undeclared files are not read, displayed, or deleted.

Every map describes exactly one repository. A reference may point to any safe
relative path in that repository, including multiple application directories.
Repository owners retain the files and can use the published schemas with other
tools. Layout coordinates, colors, UI selection, and navigation state are not part
of the format. There is no AI-provider field or required network service.

## Manifest

| Field | Meaning |
| --- | --- |
| `schemaVersion` | Exact supported format version, currently `1.0.0` |
| `project.id` | Stable project identity, independent of display name |
| `project.name`, `description` | Human-readable project context |
| `project.contentLanguage` | Content-language tag, for example `en` or `fa` |
| `project.repository` | One GitHub host/owner/name tuple; metadata, not authorization |
| `coverage` | Review scope and known gaps for the map |
| `rootProcessIds` | Processes visible in the overview, in author-chosen order |
| `processes` | One declaration per process with its stable ID and canonical file |
| `relationships` | Optional real relationships between overview processes, each with stable ID, endpoints, label, and explanation |

An empty `relationships` array is valid. Independent processes must not be connected
for decoration. Every declared process must be reachable from the overview through
subprocess references or be an overview process itself. Empty repository onboarding
is a future UI state, not an invented valid map with no known processes.

## Processes, nodes, and edges

Each process has `schemaVersion`, `id`, `title`, `purpose`, `behavior`, `evidence`,
`coverage`, `entryNodeId`, `nodes`, and `edges`. Purpose explains what the process
achieves; titles and descriptions use plain language. Incoming and outgoing links
are derived from edges rather than duplicated in node records.

Each node has `id`, `title`, `description`, `kind`, `behavior`, and `evidence`.

| Node kind | Meaning and extra fields |
| --- | --- |
| `start` | One entry marker per reviewed process; no incoming and exactly one outgoing edge |
| `action` | A step in the application |
| `decision` | At least two outgoing alternatives with explicit conditions |
| `subprocess` | Open a shared process using `processId`; no copied child definition |
| `wait` | Work remains pending; waiting is not completion |
| `external` | A boundary with another system; describe only the inspected caller contract |
| `end` | A terminal result with `outcome`: `success`, `error`, `cancel`, `unknown`, or `handed_off`; no outgoing edges |

Every edge has a stable `id`, local `from`/`to` node IDs, a nonempty `label`, and a
`kind`: `normal`, `success`, `error`, `cancel`, `retry`, or `timeout`. `condition` is
mandatory on every decision output and every node with multiple outgoing edges.
Use the actual predicate, including fallback and failure conditions. The validator
can reject missing or duplicate condition text; it cannot prove conditions are
exhaustive, mutually exclusive, or semantically correct.

Subprocess edges in a parent describe when that parent continues after the child
returns. Conditions should name the child's result. They are documented behavior,
not a workflow execution engine. Async initiation, waiting, and completion must
be separate steps; an end with `handed_off` explicitly means this scope ends before
the background work completes. Do not invent external-system internals.

## Identity, reuse, and hierarchy

IDs match `[a-z][a-z0-9._-]{0,95}`. Each namespace is independent: project, process,
node, edge, and overview relationship. Process IDs are unique within a map; node
IDs and edge IDs are each unique across all processes in that map. They are not
generated again when a title changes. A moved node retains its ID, with affected
edges updated. File names are based on process IDs, never on display titles.

A subprocess can be referenced by multiple parents. The containment graph must be
acyclic, including self-references, but ordinary control-flow edges may contain real
retry or waiting cycles. Hierarchy depth is not fixed at three levels. The validator
uses iterative graph traversal; a 600-level example is exercised by the test suite.
A viewer will need a navigation path for a shared child rather than one global
parent property. That interaction is Phase 2.

Reviewed processes have exactly one start matching `entryNodeId`, and all their
nodes are reachable from it. A nonterminal dead end is an error for complete coverage
and a warning for partial coverage with a declared gap. A long-lived process may
legitimately remain in a waiting cycle without an end; validation does not invent
termination or prove liveness. The author must explain that behavior.

## Behavior, evidence, and coverage are different

| Dimension | Values | What a reader may conclude |
| --- | --- | --- |
| `behavior` | `implemented`, `planned`, `unknown` | What the author claims exists today; never an automatic verification badge |
| `evidence.kind` | `code` | At least one code reference was supplied; not proof that it exists or supports the claim |
| `evidence.kind` | `inference` | An interpretation with an explicit reason and optional supporting references |
| `evidence.kind` | `unspecified` | No source supplied; requires a reason and an empty reference list |
| `coverage.status` | `complete` | The declared scope was reviewed; gaps must be empty |
| `coverage.status` | `partial` | Some of the declared scope remains unknown; nonempty gaps required |
| `coverage.status` | `unreviewed` | No steps may be invented; nonempty gaps required |

An unreviewed process has unknown behavior, unspecified evidence, `entryNodeId: null`,
and empty node/edge arrays. It remains discoverable. This is different from a known
missing feature. Planned features have separate planned processes; current paths
cannot invoke or incorporate them as implemented steps. The validator prevents
mixing planned nodes into an implemented process or linking current and planned
processes as an executable overview relationship.

A map containing partial/unreviewed processes cannot claim complete map coverage.
An inferred or source-unspecified step can be structurally valid and reviewed within
a scope; its evidence limitation must still be shown. No generic `verified` or
`upToDate` field exists. Freshness tracking and semantic review receipts belong to
later phases and must not be inferred from validator success.

## Code references and versions

A reference contains `path` and optionally `symbol`, `startLine`, and `endLine`.
Lines are 1-based; an end requires a start and cannot precede it. A source path is
literal and repository-relative. Absolute paths, traversal, backslashes, `.git`
segments, control characters, URL syntax, `%`, `?`, and `#` are rejected. This first
format deliberately cannot link unusual Git filenames containing those characters;
use unspecified evidence with a reason until a compatible path policy is designed.

References do not embed a branch or a per-process commit. The future GitHub reader
must resolve the selected branch/PR once to an immutable commit and fetch the
manifest, all processes, and source links at that same commit. This avoids mixed
versions and the self-referential problem of embedding the commit of a file within
the file itself. The declared repository is untrusted metadata; the reader must
compare it with the authorized repository it actually loaded.

`codeReferenceUrl(reference, snapshot)` accepts the reader's repository and a full
40- or 64-character hexadecimal commit SHA. It rejects mutable branch names and
creates an encoded GitHub blob link. It does not fetch a file, verify a symbol, or
grant access. Never substitute a map-provided URL or another branch as a fallback.
Future consumers must check missing/moved references and retain honest warnings.

## Schema compatibility and extensibility

The portable schemas are in `schemas/`, use JSON Schema 2020-12, and refer to bundled
schemas by URN. Register `common.schema.json` before the other schemas in an external
validator. The TypeScript implementation uses the [Ajv 2020-12 entry point](https://ajv.js.org/json-schema.html#draft-2020-12-breaking)
in strict mode; it never downloads or compiles a schema supplied by a map.

Only exact version `1.0.0` is currently supported. Unsupported versions are rejected
with a migration instruction. No legacy version or automatic migration exists yet.
To evolve the contract: publish a new version and compatibility notes, add fixtures
and explicit migration tests, preserve IDs and unaffected content, validate a migrated
copy, and review it before replacing originals. Never simply change `schemaVersion`
or silently discard unfamiliar fields. Unknown fields currently fail validation;
new fields require a versioned decision, not undocumented arbitrary extensions.

## Trust boundary and limits

All map text is untrusted plain text. No HTML is executed by the validator. A future
viewer must render text safely and apply its own access controls; Phase 1 does not
prove browser XSS protection or private-repository isolation. Secrets and real
customer data must never be placed in examples or map descriptions.

The local reader accepts a stable checkout supplied by the caller, reads only the
manifest and its canonical process files, rejects file/directory symlinks, and
never rewrites files or executes repository code. It is not an atomic Git snapshot
reader or a sandbox against concurrent hostile changes to the local filesystem.
The hosted reader must fetch immutable Git objects instead.

Operational safety budgets are explicit, not product hierarchy limits:

| Budget | Limit |
| --- | --- |
| Process documents per map | 1,000 |
| Nodes / edges per process | 10,000 / 30,000 |
| Nodes / edges per loaded map | 100,000 / 200,000 |
| Overview relationships | 5,000 |
| UTF-8 file / total map bytes in the local reader | 2 MiB / 16 MiB |
| Returned bundle diagnostics | 200 |

Exceeding a budget is an error; data is not truncated into a misleading valid map.
Diagnostic output is capped, so fix reported issues and validate again. These
budgets need measured review for larger projects in the later quality phase.
