# CodeVista

Explore what an application does, from its main business processes to individual
steps, decisions, and reusable subprocesses. **CodeVista** turns repository-owned
flow definitions into an interactive application map.

Your existing coding agent generates and maintains portable flow files beside your
code. CodeVista reads those definitions from GitHub. It does not call an AI API,
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

## Install CodeVista in your AI coding workflow

There are two separate setups: an operator hosts the viewer once; each project
owner installs the portable authoring kit in their application repository. You do
**not** need to install the CodeVista server inside every application, install a
special AI model, or give CodeVista an AI API key. Your existing agent subscription
or API billing still applies. The kit is a ZIP of files, not an npm package or a
universally installable chat plugin.

### Browser and cloud coding agents

1. Open your operator's CodeVista URL, sign in, install its GitHub App for selected
   repositories, and open **Projects**. Select the application and its base branch.
2. On the missing-map screen, copy the generated setup prompt and download the
   agent kit. The prompt includes the correct repository, branch, and host URL.
3. Open your repository-capable AI environment, select the **same repository and
   branch**, and paste the prompt. Attach the ZIP if its environment cannot fetch
   the host URL. Give it repository read/write access and a Node.js 22.13+ runtime.
4. Ask it to inspect the implementation, install the kit under `.codevista`,
   preserve existing instructions and stable IDs, generate and validate the maps,
   and publish its branch or PR. Do not paste private source into a public chat.
5. Return to CodeVista and refresh. Select that published branch or PR. An unmerged
   PR's map does not automatically appear on the base branch.

This workflow applies to Codex cloud, Claude Code on the web, Copilot cloud agent,
Cursor cloud agents, and other environments **when their actual session can read,
edit, execute commands, and publish the repository**. In ChatGPT/ChatGPT Work or
Claude chat, a repository connector alone may only read: check available actions.
If it cannot run Node or publish files, move the task to a coding environment or
have a developer validate and commit its proposed files. Uploading a ZIP into chat
alone does not install persistent repository instructions. A personal CodeVista
skill is optional; the repository's current format and kit remain authoritative.

### Terminal agents and IDE agents

First install and authenticate your chosen agent using its vendor's documentation.
Then open your **application repository**, not the CodeVista host repository:

```sh
cd /path/to/your/application
node --version  # 22.13 or newer
git status --short
```

Give the agent the setup prompt from your CodeVista project. Ask it to download and
inspect the kit, reject archive traversal/symlinks, and copy its FORMAT.md, schemas,
MAINTENANCE.md, and tools into `.codevista` without replacing existing manifests or
processes. No `npm install` is needed in the target application for the bundled
validator. Let the agent append the maintenance block once to the instructions it
actually loads; preserve every unrelated instruction.

| Environment                                                  | Persistent project instructions                          | How to use the kit                                                                                                                             |
| ------------------------------------------------------------ | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Codex CLI / IDE / repository coding environment              | `AGENTS.md`                                              | Open the repo, paste the setup prompt, confirm project instructions loaded.                                                                    |
| Claude Code terminal / IDE / web                             | `CLAUDE.md`                                              | Append the maintenance block; use `/context` to check loaded memory files.                                                                     |
| Gemini CLI                                                   | `GEMINI.md`                                              | Append the block and use `/memory show` to inspect loaded context.                                                                             |
| GitHub Copilot CLI / IDE / cloud agent                       | `.github/copilot-instructions.md`                        | Append the block and enable repository instructions in that surface.                                                                           |
| Cursor editor / CLI / cloud agent                            | `AGENTS.md` or an always-applied project rule            | Open/select the repository and use Agent with the setup prompt.                                                                                |
| Windsurf / Cascade                                           | A workspace rule in `.windsurf/rules/`                   | Use an always-on rule for maintenance; verify the installed version's rule discovery.                                                          |
| Cline, Roo Code, Aider, Continue, OpenCode, and other agents | Their configured project rules or explicit context files | Add `.codevista/MAINTENANCE.md` and FORMAT.md to persistent context using that tool's supported mechanism. Do not assume it reads `AGENTS.md`. |
| Plain web chat or a read-only repository connector           | Chat/project instructions only                           | Can help draft maps; cannot finish installation until a writable coding environment validates and publishes them.                              |

This is a capability-based integration guide, not a claim of certified support for
every agent/version. Vendor interfaces and instruction discovery can change. Start
a fresh session and ask the agent to identify the maintenance rules it loaded.

Official instruction references:
[Codex](https://developers.openai.com/codex/guides/agents-md),
[Claude Code](https://code.claude.com/docs/en/memory),
[Gemini CLI](https://geminicli.com/docs/cli/gemini-md/),
[Copilot](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/add-custom-instructions/add-repository-instructions),
[Cursor](https://cursor.com/docs/rules), and
[Cascade](https://docs.windsurf.com/windsurf/cascade/memories).

### Validate, publish, and keep maps current

The agent runs these commands in the target application's root after generation:

```sh
node .codevista/tools/validate.mjs .codevista
# Commit the reviewed source, map, and instruction files first.
node .codevista/tools/review.mjs --result updated --note "Initial application flow review"
# Commit .codevista/review.json, then push the same branch and open/update its PR.
```

After each later code task, request: “Update affected CodeVista flows, preserve IDs
and unrelated maps, validate, record a review of the final source, and publish on
the same branch.” Use `--result no-flow-change` only after inspecting a change that
really has no flow impact. A passing validator checks structure, not correctness
or completeness. Use the project's recovery prompt for missing or stale reviews.

Expected result: `.codevista/manifest.json`, declared process files, FORMAT.md,
schemas, tools, maintenance instructions, and a source-bound `review.json` are
published in your application's repository. Open a process card to drill into its
flowchart; click subprocesses to go deeper and steps to inspect source references.

## Appearance

The panel header offers **System theme**, **Light mode**, and **Dark mode**.
System follows your operating system live. An explicit choice persists in this
browser and synchronizes across tabs; blocked browser storage falls back to the
current page. Theme preferences contain no repository data.

## Deploy for your users

Follow the complete [deployment guide](docs/deployment.md) for a single-server
Linux deployment with HTTPS, a GitHub App, persistent storage, systemd, backups,
updates, rollback, and the first-user onboarding checks. The connected viewer
requires a Node server; uploading `web-dist` to GitHub Pages or Cloudflare Pages
alone does not provide authentication or repository APIs.

Upgrading an older installation? Read [migration](docs/migration.md) first.

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

This repository documents its own implemented behavior in `.codevista`. See the
[process index and coverage notes](docs/repository-flows.md) for authentication,
projects, immutable snapshots, PR comparison, viewer navigation and local tools.
