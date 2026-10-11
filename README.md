# LogicAtlas

Explore what an application does, from its main business processes to individual
steps, decisions, and reusable subprocesses. The working name is **LogicAtlas**;
this repository is **CodeVista**, and the original plans used **AppFlow**.

Your existing coding agent generates and maintains portable flow files beside your
code. LogicAtlas reads those definitions from GitHub. It does not call an AI API,
require an AI API key, or replace your coding agent. Agent work may consume your
existing quota; hosting has its own costs.

**Status: implementation candidate, not a certified production release.** The
viewer, agent kit, GitHub App integration, onboarding, snapshots, comparison, and
privacy controls are implemented. Automated tests use synthetic data and mocked
GitHub responses. A real configured GitHub App, two-account private repository
trial, fresh Claude web session, and independent user/self-hosting trials remain
release gates. See [acceptance evidence](docs/acceptance.md). No hosted deployment,
GitHub release, or supported-agent certification is claimed.

## Run the public demo

Use Node.js **22.13 or newer** (Node 24 recommended) and npm:

```sh
npm ci
npm run build
npm start
```

Open **http://localhost:3000**. No account or credentials are needed for the public
sample. Choose Before changes, After changes, or the 413-step scale fixture.
Preview reference changes to inspect additions, removals, and changed conditions.

The main example contains **Purchase access → Evaluate discount → Check discount
eligibility → Check subscription**. Chat reuses the subscription process. The
sample code performs no real authentication, payment, or AI requests.

## Use a connected project

1. Sign in with GitHub on a configured host. Install its GitHub App for selected
   repositories; organization owners may need to approve access.
2. Open a project and choose its actual base branch. A missing map shows a
   copyable prompt and downloadable agent kit.
3. Give the prompt to your existing repository-capable agent. It inspects the code,
   preserves instructions and unrelated definitions, validates the map, and
   publishes code and map changes on the same branch.
4. Refresh to see published changes. Explore processes, search exact step
   locations, or select a pull request to compare its base and head.

Every private request checks both the viewer's access and the app installation.
Sharing a deep link does not grant access. All source links use the displayed
immutable commit. Structure, coverage, and recorded review freshness are separate
claims; none proves that the documented behavior is correct or executed.

See [the user guide](docs/user-guide.md), [agent workflow](docs/agent-workflow.md),
and [self-hosting setup](docs/self-hosting.md). Hosted users need only their browser
and existing coding agent. Hosting setup and contributor commands are separate.

## Develop and verify

```sh
npm ci
npm run check
npx playwright install chromium
npm run test:e2e
npm audit
```

`npm run check` builds the standalone agent kit, runs unit/integration tests,
builds the browser application, and validates both reference maps. Browser tests
run the built server with its production security headers. CI tests Node 22 and
24 and runs Chromium browser tests. Warnings on the sample maps are intentional:
partial coverage, unreviewed areas, inferred evidence, and planned behavior.

For development, run `npm run build:core`, `npm run build:kit`, then
`npm run dev:server` and `npm run dev` in separate terminals. The Vite development
server proxies `/api` and `/auth` to port 3000; configure `APP_ORIGIN` to the browser
origin when testing sign-in. Use `npm start` for the built application.

To validate a map without networking or rewriting its content:

```sh
npm run validate -- examples/reference/after --json
```

## Project structure

| Path                    | Purpose                                                                     |
| ----------------------- | --------------------------------------------------------------------------- |
| `schemas/`              | Portable JSON Schema contract, version 1.0.0                                |
| `src/`                  | Validation, references, review receipts, comparison, and agent instructions |
| `server/`               | Fastify API, encrypted SQLite sessions, read-only GitHub access, snapshots  |
| `web/`                  | React/React Flow viewer, projects, onboarding, and version inspection       |
| `scripts/build-kit.mjs` | Downloadable validator and review tools with bundled dependencies           |
| `examples/reference/`   | Executable synthetic behavior and before/after maps                         |
| `tests/`                | Contract, workflow, security, snapshots, scale, and browser tests           |
| `docs/`                 | Format, architecture, roadmap, operator guidance, and acceptance evidence   |

## Documentation and contribution

- [Flow format](docs/flow-format.md) and [authoring rules](docs/authoring.md)
- [Architecture and privacy](docs/architecture.md)
- [Requirements, dependencies, and source-plan cross-reference](docs/roadmap.md)
- [Acceptance record and release gates](docs/acceptance.md)
- [Contributing](CONTRIBUTING.md), [security reporting](SECURITY.md), and [changes](CHANGELOG.md)

All project-owned content is English. User-authored map content supports Unicode
and automatic text direction. No private repository data is included in examples.
The code is licensed under [MIT](LICENSE); third-party dependencies retain their
own licenses. The agent ZIP includes notices for bundled dependencies.

## Repository application flows

This repository documents its own implemented behavior in `.logicatlas`. See the
[process index and coverage notes](docs/repository-flows.md) for authentication,
projects, immutable snapshots, PR comparison, viewer navigation and local tools.
