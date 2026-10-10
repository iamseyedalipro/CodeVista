# Project instructions

- Product: LogicAtlas (working name), in the CodeVista repository. The supplied plans
  used AppFlow. Follow `docs/roadmap.md` and the original product requirements.
- All project-owned code comments, docstrings, documentation, UI strings, messages,
  examples, and instructions must be English.
- Respect the phase dependencies in docs/roadmap.md. Track implementation separately
  from acceptance in docs/acceptance.md. Never claim a live provider, external-agent,
  human usability, or self-hosting trial passed without recorded evidence.
- Use the user's existing coding agent to maintain maps. Never add a separate AI API
  or request credentials for an AI account.
- Read `docs/flow-format.md` and `docs/authoring.md` before changing the map contract
  or examples. Preserve stable IDs and unrelated process definitions.
- Keep quality, unreviewed coverage, and source uncertainty explicit. Validation
  success is not proof of semantic accuracy or code/map freshness.
- Keep the core validator free of filesystem/network access. Node-specific reading
  belongs in `src/load.ts`. Treat repository-authored content as untrusted.
- After changes, review affected map examples and references, run `npm run check` and relevant `npm run test:e2e` scenarios,
  update acceptance evidence and documentation, and report limitations honestly.
