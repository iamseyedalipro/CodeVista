export function Help() {
  return (
    <main className="panel">
      <div className="eyebrow">YOUR CODE. YOUR AGENT. YOUR MAP.</div>
      <h1>From repository to understanding</h1>
      <section className="section-card">
        <h2>1. Connect a project</h2>
        <p>
          Sign in with GitHub, then install this host's GitHub App for only the
          repositories you choose. Organization repositories may require owner
          approval or SSO authorization. Each viewer must have their own
          repository access. Sharing a link never grants access.
        </p>
      </section>
      <section className="section-card">
        <h2>2. Ask your existing coding agent</h2>
        <p>
          Select a repository and branch, copy the setup prompt, and give it to
          the coding agent you already use. The agent inspects your code and
          saves portable JSON definitions under .codevista. Downloadable tools
          validate those files and record a review receipt. This application
          does not call an AI service or require an AI API key.
        </p>
        <p>
          Publish the agent's changes to the selected GitHub branch, then choose
          Refresh. Work that is still local or running in an agent session is
          not visible here.
        </p>
      </section>
      <section className="section-card">
        <h2>3. Explore and review changes</h2>
        <p>
          Open a process from the overview. Select a step for its explanation,
          outgoing paths, and source evidence. Use Open subprocess to go deeper;
          breadcrumbs and browser Back return to the previous level. Search
          opens the exact step. Pan, zoom, or fit the diagram using its
          controls.
        </p>
        <p>
          The version strip identifies the selected and displayed commits.
          Review freshness, structural validity, and coverage are separate. A
          review receipt records an agent's claim; it does not prove that the
          map is semantically correct. Pull request comparisons use the recorded
          base and head commits and never update the base branch.
        </p>
      </section>
      <section className="section-card">
        <h2>Privacy and removal</h2>
        <p>
          GitHub grants read access to repository contents and pull requests;
          its permission model cannot restrict access to one folder. CodeVista
          reads Git tree metadata and map JSON files. It never executes
          repository code, fetches complete source files, or sends repository
          content to an AI service. Source links open GitHub at the displayed
          commit.
        </p>
        <p>
          Session credentials and saved branch preferences are encrypted in this
          host's database. Sessions expire after eight hours. Branch preferences
          expire after 30 days without a settings update. Minimal disconnected
          repository IDs remain encrypted until reconnection or account
          deletion, so expiry does not reconnect a project. Previously valid
          maps may remain in server memory for up to 15 minutes, bounded to 64
          MiB per server. Private responses are not stored in browser storage.
          No analytics or third-party scripts are used.
        </p>
        <p>
          Disconnect hides a project in this account and clears cached maps.
          Delete local account data removes sessions and preferences from this
          host; it does not delete GitHub files, revoke the GitHub App, or
          control operator backups. Use GitHub Settings to revoke the app's
          access. Host operators control database backups and should document
          their retention policy.
        </p>
      </section>
      <section className="section-card">
        <h2>Self-hosting and contribution</h2>
        <p>
          Deploy your own host and GitHub App. The portable format, validator,
          and viewer do not depend on a central CodeVista service.
        </p>
        <div className="help-links">
          <a
            href="https://github.com/iamseyedalipro/CodeVista"
            target="_blank"
            rel="noreferrer"
          >
            Source and setup ↗
          </a>
          <a
            href="https://github.com/iamseyedalipro/CodeVista/blob/master/CONTRIBUTING.md"
            target="_blank"
            rel="noreferrer"
          >
            Contributing ↗
          </a>
        </div>
      </section>
    </main>
  );
}
