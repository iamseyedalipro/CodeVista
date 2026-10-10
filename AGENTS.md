# Project instructions

- Product: LogicAtlas (working name), in the CodeVista repository. The supplied plans
  used AppFlow. Follow `docs/roadmap.md` and the original product requirements.
- All project-owned code comments, docstrings, documentation, UI strings, messages,
  examples, and instructions must be English.
- Implement one phase at a time. Phase 1 is the portable map contract; do not claim
  a viewer, authorization, freshness, or cloud-agent integration exists yet.
- Use the user's existing coding agent to maintain maps. Never add a separate AI API
  or request credentials for an AI account.
- Read `docs/flow-format.md` and `docs/authoring.md` before changing the map contract
  or examples. Preserve stable IDs and unrelated process definitions.
- Keep quality, unreviewed coverage, and source uncertainty explicit. Validation
  success is not proof of semantic accuracy or code/map freshness.
- Keep the core validator free of filesystem/network access. Node-specific reading
  belongs in `src/load.ts`. Treat repository-authored content as untrusted.
- After changes, review affected map examples and references, run `npm run check`,
  update acceptance evidence and documentation, and report limitations honestly.
