# LogicAtlas (working name)

LogicAtlas will let users explore an application's business flows, then open
individual processes and subprocesses. This repository is named **CodeVista**;
the attached plans used **AppFlow** as an earlier working name.

The user's existing coding agent owns flow generation and maintenance. Flow files
live beside the application code in its GitHub repository. LogicAtlas does not
need a separate AI API, an AI account password, or an AI API key. Documentation
work may still consume the user's existing agent quota; hosting is a separate cost.

**Current state: Phase 1 implementation, not a deployed viewer.** This repository
contains a portable versioned flow contract, TypeScript types, structural and
graph validation, a read-only local validation command, and synthetic before/after
examples. There is no website, GitHub sign-in, private-repository authorization,
hosted onboarding, or branch/PR synchronization yet. Those are later phases.

## Try the Phase 1 foundation

For contributors, install Node.js 22 or newer and run:

```sh
npm ci
npm run check
```

To validate the example or another map directory after building:

```sh
npm run build
npm run validate -- examples/reference/after
npm run validate -- examples/reference/after --json
```

The examples intentionally produce warnings for incomplete coverage, an unreviewed
process, and a planned feature. A valid structure does **not** prove source accuracy,
freshness, completeness, authorization, or successful execution of the documented
application. No map content is sent over the network by the validator.

These commands are contributor tools. They do not replace the planned browser-only
experience for hosted users.

## Explore the contract

- [Flow format and validity rules](docs/flow-format.md)
- [Reference scenarios and before/after walkthroughs](docs/reference-scenarios.md)
- [Agent-neutral authoring and maintenance rules](docs/authoring.md)
- [Scope, dependencies, and cross-reference between both plans](docs/roadmap.md)
- [Phase 1 acceptance evidence and remaining gates](docs/phase-1-acceptance.md)
- [Contribution workflow](CONTRIBUTING.md)

The example's deepest path is **Payment → Discount → Eligibility → Subscription**.
Chat reuses the same Subscription definition. Login is independent: no decorative
edge connects unrelated processes. The sample application and all its data are
synthetic; it performs no real authentication, payment, or AI requests.

## Repository layout

| Path | Purpose |
| --- | --- |
| `schemas/` | Portable JSON Schema 2020-12 contract, version 1.0.0 |
| `src/` | Types, validation, immutable source-link helper, and local reader/CLI |
| `examples/reference/` | Executable synthetic behavior and before/after flow files |
| `tests/` | Contract, graph, reader, CLI, and behavioral regression tests |
| `docs/` | Contract rules, scope, acceptance record, and future phase dependencies |

All project-owned comments, documentation, errors, examples, and instructions are
English. The data format accepts Unicode user content and a content-language tag;
future viewers must support Persian and English without translating code identifiers.

The repository has not yet been released as an installable package. Selection of
an open-source license and the complete self-hosting/security documentation remain
release gates; a public repository alone is not a license grant.
