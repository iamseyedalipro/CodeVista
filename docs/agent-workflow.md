# Existing-agent workflow

LogicAtlas supplies instructions and local tools; it does not supply a new coding
agent or call an AI model. The intended initial route is a repository-capable Claude
web environment. **That external environment has not been tested in this change.**
Ordinary chat access is not sufficient: the agent must actually read files, run
Node/Git tools in its own workspace, and publish a branch/PR. Other agents need the
same capability trial before support is claimed.

## Initial setup

On a configured host, choose a repository and branch. Copy the setup prompt into
your existing coding agent. The prompt includes the exact repository, branch,
chosen map language, and a public URL for the versioned host's agent kit.

The agent should download and inspect the ZIP, then extract its tools and schemas
under `.logicatlas` without overwriting existing map documents. Preserve existing
AGENTS.md/CLAUDE.md instructions; append the maintenance rules once in the file the
actual environment reads. The marker makes appending idempotent. A saved instruction
is not a guarantee that every future agent session will follow it.

The agent inspects real code paths, creates a manifest and separate process files,
and labels unreviewed areas. It must not invent behavior from filenames or a product
pitch. Existing IDs survive rename/move operations. Shared subprocesses have one
definition. Broad initial coverage can be partial if its scope and gaps are explicit.

The standalone tools include their runtime dependencies; no npm install is needed
inside the user's repository. Node.js 22.13+ and Git are required in the **agent's**
environment, not in the hosted user's browser.

## Finish a code task

1. Complete the code change and inspect its behavioral impact, including callers,
   shared subprocesses, conditions, errors, retries, async boundaries, and outcomes.
2. Update only affected definitions and references. Remove behavior that no longer
   exists. Preserve unrelated definitions and existing project instructions.
3. Run the standalone validator. Fix structural errors; disclose partial coverage
   and uncertain evidence instead of removing warnings.
4. Commit the finalized code, instructions, and map on the task's branch.
5. Record the review receipt for that source tree and map, then commit the receipt
   on the same branch and publish the related changes together.
6. Report affected processes, remaining gaps, and verification results.

Commands run by the agent at the repository root:

```sh
node .logicatlas/tools/validate.mjs .logicatlas
node .logicatlas/tools/review.mjs --result updated --note 'Reviewed payment and its dependent discount process.'
```

For an inspected change with no flow impact:

```sh
node .logicatlas/tools/review.mjs --result no-flow-change --note 'Only explanatory comments changed; the documented behavior is unchanged.'
```

The review tool refuses uncommitted files outside `.logicatlas`. Commit code and
instructions first. The receipt itself is excluded from the source digest, so its
commit does not invalidate its own review. It does not read a hosted API or upload
anything. Review is a claim tied to content, not proof of semantic accuracy.

## Recover a forgotten or failed update

Use Get recovery prompt on a map error, or ask the existing agent to review the
selected branch against the last meaningful code change. Reuse the saved schema
and maintenance instructions. Repair the map rather than changing application
behavior to satisfy the map. Validate, record an appropriate receipt, and publish
on the same branch. Refresh only after publication. Local or agent-in-progress
changes cannot be observed by the site.

If the environment cannot download tools, run commands, inspect source, or publish,
record that limitation and stop claiming completion. Do not request an AI password
or buy a separate API. Changing agent environments is a compatibility decision that
requires its own acceptance trial.

## Reproducible local evidence and external gate

`tests/agent-kit.test.mjs` extracts the downloadable ZIP into an isolated Git
repository with no installed dependencies, validates a map, records an update,
rejects dirty source, records an exact no-op review after a source-only change,
and checks preservation of an unrelated process. Contract/scenario tests cover
discount changes, a sign-in fix, and stable identity changes.

These tests prove the tools' behavior. They do **not** prove autonomous maintenance
in Claude web. Before claiming Phase 3 acceptance, run initial setup, feature,
bug-fix, deletion/rename, no-op, failed-map recovery, and a fresh-session task in
the intended external environment. Record its exact product/version/date and the
published commits, preserving private evidence outside this public repository.
