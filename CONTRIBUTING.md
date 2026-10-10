# Contributing

Use Node.js 22.13+ or 24 and install locked dependencies with `npm ci`. Before
submitting a change, run:

```sh
npm run check
npx playwright install chromium
npm run test:e2e
npm audit
```

Tests use Node's test runner for contract, agent-tool, API/security, snapshot, and
comparison behavior. Playwright runs the built server for browser acceptance.
Use `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` only when a managed environment supplies
its own Chromium; normal CI installs Playwright's matching browser.

Follow the requirements and dependencies in [the roadmap](docs/roadmap.md). Keep
source comments, docstrings, UI strings, examples, and documentation in English.
Update the affected acceptance evidence. Do not report a mocked provider trial as
a live one, or a structural validator as proof of semantic correctness.

Preserve stable identities and unrelated flow definitions. Schema changes require
an explicit version/compatibility decision, migration evidence, and matching
TypeScript types. Never silently relabel old maps or remove warnings to make checks
pass. Do not execute repository code on the server or add a separate AI service.

Add focused regression tests for meaningful behavior and security changes. Cover
permission failures before cached reads, immutable revision boundaries, malformed
content, and cleanup for new data stores. Prefer narrow modules and plain language.
Format changed TypeScript/TSX/JS/CSS/Markdown with the pinned Prettier dependency.

Use synthetic fixtures. Never attach secrets or private repository content to
public issues, test artifacts, logs, or PRs. Browser traces can contain page data;
only synthetic-data tests may upload them to public CI artifacts.

Open a GitHub issue for a reproducible bug or a proposed capability. Describe the
user problem, expected/actual behavior, supported runtime, and a minimal public
reproduction. Follow [SECURITY.md](SECURITY.md) for vulnerabilities. Contributions
are accepted under the project's MIT license; dependencies retain their licenses.
