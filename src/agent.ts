export interface SetupContext {
  repository: string;
  branch: string;
  language: string;
  kitUrl: string;
}
export const MAINTENANCE_RULES = `## CodeVista flow maintenance

After completing code changes and before declaring a task finished:
1. Read .codevista/manifest.json, existing process definitions, and .codevista/FORMAT.md.
2. Inspect the final code and identify affected processes and dependent callers. Update only those definitions. Preserve unrelated files, stable IDs, and other project instructions.
3. Represent real decisions, errors, cancellations, waits, retries, shared subprocesses, source references, and coverage gaps. Keep planned and unknown behavior distinct from implemented behavior.
4. For a rename or move, retain identity. For a deletion, remove obsolete behavior and repair callers. For a non-behavioral change, do not manufacture a flow edit.
5. Run node .codevista/tools/validate.mjs .codevista. Report errors honestly; do not change application behavior merely to satisfy the diagram.
6. Commit the final code, instructions, and map changes on this same branch. Then run node .codevista/tools/review.mjs --result updated --note "Describe the reviewed change" (or --result no-flow-change). Commit the resulting .codevista/review.json on the same branch. Any later change outside .codevista requires a new review.
7. Report changed process IDs, structural checks, coverage gaps, and any unfinished review. A valid format or receipt is not proof of semantic correctness.
Never add a separate AI API, send secrets/customer data into maps, or regenerate unaffected maps. If blocked, preserve existing valid content and report the limitation. An instruction file is a reminder, not a guarantee of agent compliance.`;

export function setupPrompt(context: SetupContext): string {
  return `Set up CodeVista application-flow documentation for ${context.repository} on branch ${JSON.stringify(context.branch)}.
Use the repository-capable coding environment you already have. Do not request a separate AI API key. Additional work may consume the user's existing agent quota.

Download the authoring kit from ${context.kitUrl} in your coding environment. It contains FORMAT.md, JSON Schemas, MAINTENANCE.md, and standalone Node.js validation/review tools. Extract its files under .codevista without overwriting existing map definitions. Read the format before generating content. The user should not need a local terminal.

Inspect actual application code. Create .codevista/manifest.json and processes/<stable-id>.json according to schema 1.0.0. Use ${JSON.stringify(context.language)} for map titles and descriptions, preserving code identifiers and paths. Cover known business processes, then reusable subprocesses. Do not infer features merely from filenames. Explicitly record unreviewed areas, partial coverage, uncertain interpretations, errors, cancellation, waiting, retry, and external boundaries.

If a map already exists, reuse it and its stable IDs. Continue incomplete work or repair affected sections; never duplicate processes or discard unrelated definitions. Preserve all existing project instructions. Append the supplied MAINTENANCE.md block to the instruction file your environment actually reads (for example AGENTS.md or CLAUDE.md) once, retaining all other content. Check the instruction-file discovery behavior of your actual environment.

Validate with node .codevista/tools/validate.mjs .codevista. Commit code, map, and instruction changes on the same branch or PR. Generate a review receipt with node .codevista/tools/review.mjs --result updated --note "Initial flow review" and commit it on the same branch. Do not claim the website can see these files until the branch/PR is published to GitHub.

Report process IDs, coverage gaps, checks and failures, and the published branch/PR. Do not call the map complete merely because validation passes. If this environment cannot read and publish repository changes, explain that limitation instead of pretending the setup succeeded.`;
}

export function recoveryPrompt(
  context: SetupContext,
  issues: string[] = [],
): string {
  return `Review and repair the existing CodeVista map in ${context.repository} on ${JSON.stringify(context.branch)} against the actual final code.
${issues.length ? `Observed issues: ${issues.slice(0, 20).join("; ")}` : "A review is missing, incomplete, or older than the selected source/map content."}
Read the existing map and saved maintenance instructions. Preserve stable IDs, valid unrelated definitions, and all other project rules. Review changed processes and their dependent callers. Correct documentation to match code; do not modify application logic only to make the diagram pass. Keep uncertainty and incomplete coverage visible.
Run the supplied validator. Record updated or no-flow-change for this exact source/map using the review tool after committing the final source. Commit the receipt and publish the same branch/PR. Report what changed and what remains unverified. No separate AI API is allowed.`;
}

/** Append exactly once; never replace existing repository instructions. */
export function appendMaintenance(existing: string): string {
  return existing.includes("## CodeVista flow maintenance")
    ? existing
    : `${existing.trimEnd()}${existing.trim() ? "\n\n" : ""}${MAINTENANCE_RULES}\n`;
}
