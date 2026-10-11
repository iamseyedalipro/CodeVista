# Project instructions

- Product: CodeVista. The supplied plans
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

## CodeVista flow maintenance

After completing code changes and before declaring a task finished:
1. Read .codevista/manifest.json, existing process definitions, and .codevista/FORMAT.md.
2. Inspect the final code and identify affected processes and dependent callers. Update only those definitions. Preserve unrelated files, stable IDs, and other project instructions.
3. Represent real decisions, errors, cancellations, waits, retries, shared subprocesses, source references, and coverage gaps. Keep planned and unknown behavior distinct from implemented behavior.
4. For a rename or move, retain identity. For a deletion, remove obsolete behavior and repair callers. For a non-behavioral change, do not manufacture a flow edit.
5. Run node .codevista/tools/validate.mjs .codevista. Report errors honestly; do not change application behavior merely to satisfy the diagram.
6. Commit the final code, instructions, and map changes on this same branch. Then run node .codevista/tools/review.mjs --result updated --note "Describe the reviewed change" (or --result no-flow-change). Commit the resulting .codevista/review.json on the same branch. Any later change outside .codevista requires a new review.
7. Report changed process IDs, structural checks, coverage gaps, and any unfinished review. A valid format or receipt is not proof of semantic correctness.
Never add a separate AI API, send secrets/customer data into maps, or regenerate unaffected maps. If blocked, preserve existing valid content and report the limitation. An instruction file is a reminder, not a guarantee of agent compliance.
