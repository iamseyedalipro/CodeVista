# Contributing

Use Node.js 22 or newer. Install the locked dependencies with `npm ci`, then run
`npm run check`. Tests execute with Node's built-in test runner after TypeScript
compilation. The CLI and core validator never modify flow files.

Follow the phase boundaries in [the roadmap](docs/roadmap.md). Add a focused regression
test for a meaningful behavior or contract change, update the relevant English
documentation, and run the checks before submitting a PR. Keep source-code comments,
docstrings, examples, user-facing strings, and instructions in English.

Schema changes require an explicit version/compatibility decision and migration
evidence. Keep type definitions consistent with the portable JSON Schemas. Never
silently reinterpret older maps, rewrite unrelated examples, regenerate stable IDs,
or remove coverage warnings to make a check appear green.

Use synthetic examples only. Do not attach secrets or private repository content to
public issues, logs, fixtures, or PRs. A private security-reporting channel and an
open-source license must be selected before a public product release; this phase
does not claim those release gates are complete.
