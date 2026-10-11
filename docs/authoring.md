# Agent-neutral flow authoring rules

These are Phase 1 content and maintenance rules. Hosted copyable onboarding,
installation into other repositories, recovery prompts, and tested cloud-agent
integration are later deliverables. No agent brand has been certified by this phase.

1. Read the existing map, its schema version, and the project's existing instructions.
   Do not overwrite unrelated instructions or regenerate a valid map from scratch.
2. Inspect application code before describing behavior. Explain product processes,
   such as sign-in or payment, rather than your own tool calls or filesystem activity.
3. Start with known main processes. Add only meaningful relationships; independent
   processes may remain unconnected. Represent unreviewed areas explicitly.
4. Use stable IDs. Reuse one shared subprocess definition wherever the behavior is
   shared. Renaming a title or moving code must not manufacture a new identity.
5. Write plain titles, purposes, descriptions, and branch conditions. Include actual
   success, failure, cancellation, wait, timeout, and retry behavior where it exists.
   Do not invent missing error handling to make the diagram look complete.
6. Distinguish application behavior from your confidence about it. Supply code
   references where available, or an inference/unspecified-source reason. Keep
   planned functionality separate from the implemented flow.
7. Describe asynchronous initiation separately from completion. Explain an external
   interface without inventing the external provider's internal logic.
8. After a code change, identify affected processes and dependent callers. Update
   only definitions whose behavior, references, or coverage changed. Preserve all
   unrelated process files, stable IDs, and existing valid content.
9. Add behavior at the correct overview/subprocess location. Remove genuinely
   deleted behavior and repair references; preserving content does not mean keeping
   obsolete steps. A shared process is removed only after its callers are updated.
10. For changes without behavioral impact, do not create cosmetic map churn. Report
    that the specific change was reviewed and no flow change was needed. Phase 1
    does not yet persist version-bound review receipts or infer freshness from them.
11. Keep code and map changes on the same branch and in the same relevant PR. Never
    replace the reference branch's map with unmerged work or fallback to another
    branch when a selected version lacks a map.
12. Validate shape, identities, references, and hierarchy before finishing. Read the
    resulting paths yourself: passing validation does not establish semantic truth.
    Report affected process IDs, validation results, coverage gaps, and limitations.
13. If you cannot finish a review, preserve the valid existing content, identify the
    specific gap, and report that the map needs review. Never mark it fresh because
    a file was touched or the schema passed.

Write all CodeVista-owned content in English. User-authored map content may use its
declared language; preserve code symbols and paths exactly. Do not include secrets,
access tokens, real customer data, or private repository content in public samples.
Never request an additional AI API key or the user's coding-agent credentials.

Useful contributor checks:

```sh
npm ci
npm run build
npm run validate -- path/to/map
```

These commands run inside an available development environment. They must not become
a requirement to install local tools for ordinary users of the future hosted viewer.
