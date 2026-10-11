# User guide

## Explore the public reference project

Open the demo without signing in. Start with Purchase access. Select a step to read
its explanation and outgoing paths; selecting it does not enter a subprocess.
Open subprocess explicitly to drill into discount evaluation and eligibility.
Use breadcrumbs, Back one level, or browser Back to return.

Search finds both processes and steps and opens their exact location, including
deep/shared subprocesses. Drag the canvas to pan, use the mouse wheel or controls
to zoom, and use Fit View for the whole process. The current step and neighboring
paths are emphasized. Details include written conditions and outcomes, so meaning
does not rely only on color.

Choose Preview reference changes to inspect the synthetic before/after change.
Previous and proposed locations remain available, including deleted steps. The
scale fixture contains ten root processes, shared children, a retry loop, and 413
steps. It is a performance sample, not a real application's map.

## Connect a repository

On a configured host, choose Projects and Sign in with GitHub. Install the host's
GitHub App and select repositories. For an organization, obtain owner/SSO approval
if required. Every viewer needs their own repository permission as well as the
app's permission. Public repositories also require explicit app access when opened
as connected projects.

Refresh Projects after installing. Open the project and choose the intended branch;
it need not be named `main`. Your selected branch is saved for return visits. Check
map on a project card fetches its actual current status; Not checked makes no
claim about map availability. Disconnected projects can be reconnected.

## Create the first map with Claude web or your existing agent

A missing map displays the setup prompt and agent-kit download. Choose the desired
map language, copy the prompt, and give it to the repository-capable coding agent
you already use. Project instructions and UI are English; user-authored map content
can be multilingual.

The intended first supported route is Claude web **with an environment that can
read the repository, run tools, and publish a branch/PR**. This route is not yet
certified here. Follow [the agent workflow](agent-workflow.md), and record the
external acceptance trial before claiming support. A chat response or diagram
image alone is not a maintained map.

When the agent publishes the changes to GitHub, choose I published the changes ·
Check again. The map remains Setup needed until published map files exist at the
selected branch. Leaving/reopening the link resumes from repository state, without
pretending that unpublished agent work is observable. A user on a configured host
does not need a terminal, an AI API key, or a site administrator to generate files;
their existing agent performs repository work.

## Understand status and versions

- **Structure** means the format and graph passed validation. Invalid independent
  processes can be unavailable while safe areas remain visible.
- **Coverage** describes the declared review scope and gaps, not all repository code.
- **Review freshness** compares a recorded review with the exact source/map content.
  Reviewed is still an agent's claim, not proof of semantic accuracy.
- **Selected commit** is the branch/PR revision requested. **Displayed commit** is
  the revision actually shown. They differ only in an explicitly labeled older-map
  fallback after a malformed newer map.

Use **Refresh** to fetch published map changes. Visible private projects recheck
session and repository access every minute without reloading the diagram. Step
navigation keeps the same chart mounted while checking access; a failed check
removes private content. A hidden tab clears its private view and rechecks access
when resumed. The site never claims to observe live progress inside an agent session.

Use **Expand flowchart** to fill the browser viewport with the chart and step
details. Zoom, pan and selection remain available. Choose **Exit fullscreen** or
press Escape to return. Changing the process exits fullscreen; closing search with
Escape leaves fullscreen open.

If code changed without a matching receipt, ask the existing agent to inspect the
change. It may update affected processes or record an exact no-flow-change review.
For malformed maps, use the recovery prompt. Provider failures are connection
errors; they never imply that behavior was deleted.

## Review a pull request

Select a PR to view its head and compare the GitHub-reported base/head commits.
Expand a change to inspect old/new fields, conditions, and identity-preserving
moves. Inspect previous location works for removed steps. Use Previous version or
Proposed version to explore the full map. Missing/invalid maps suppress a complete
diff rather than inventing deletions.

A closed, unmerged PR does not change the branch map. After merge, return to Branch
view and Refresh to load the actual branch head. Forks require authorization to the
fork as well as the base repository; unavailable/deleted forks cannot be compared.

## Share, disconnect, and remove data

Copy deep link shares only a location. Recipients must sign in and pass their own
access checks. Source links open GitHub at the displayed immutable commit.

Disconnect hides a project for your account on this host and clears cached maps;
it does not revoke the GitHub App or change repository files. Reconnect from
Projects. Delete local account data removes your sessions and saved preferences
from this host. To revoke the app itself, use GitHub Settings. To remove operator
backups, follow the host's retention policy. Your map files remain portable in Git.

For SSO/approval errors, ask the organization owner to authorize the app. For rate
limits or provider outages, wait and retry. For an expired session, sign in again.
Do not paste private maps or credentials into public issues.
