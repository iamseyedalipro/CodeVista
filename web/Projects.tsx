import { useEffect, useState } from "react";
import { api, message, type RepositoryInfo, type SessionInfo } from "./api";
import type { Snapshot } from "../src/snapshot-types";

export function Projects({ session }: { session: SessionInfo }) {
  const [repositories, setRepositories] = useState<RepositoryInfo[] | null>(
    null,
  );
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [visible, setVisible] = useState(12);
  useEffect(() => {
    if (!session.user) return;
    const controller = new AbortController();
    setRepositories(null);
    setError("");
    api<{ repositories: RepositoryInfo[] }>("/repositories", {
      signal: controller.signal,
    })
      .then((result) =>
        setRepositories(
          result.repositories.sort((a, b) =>
            (b.lastVisitedAt ?? "").localeCompare(a.lastVisitedAt ?? ""),
          ),
        ),
      )
      .catch((error) => {
        if (!controller.signal.aborted) setError(message(error));
      });
    return () => controller.abort();
  }, [session.user?.login, revision]);
  return (
    <main className="panel">
      <div className="row">
        <div>
          <div className="eyebrow">YOUR WORKSPACE</div>
          <h1>Projects</h1>
        </div>
        {session.user && (
          <button onClick={() => setRevision((value) => value + 1)}>
            Refresh projects
          </button>
        )}
      </div>
      {!session.user ? (
        <section className="section-card">
          <h2>Understand your private repositories</h2>
          <p>
            Connect only the repositories you choose. You and the GitHub App
            must both have access. CodeVista uses your existing coding agent
            and does not charge for an AI API.
          </p>
          {session.configured ? (
            <a className="button-link primary" href="/auth/github">
              Sign in with GitHub →
            </a>
          ) : (
            <div className="notice">
              This host has not configured its GitHub App. Follow the
              self-hosting guide to enable private projects. The public demo
              works without configuration.
            </div>
          )}
          <p>
            <a href="#/demo/after">Explore the public demo</a> ·{" "}
            <a href="#/help">How it works and privacy</a>
          </p>
        </section>
      ) : (
        <>
          <p>
            Signed in as <strong>{session.user.login}</strong>. Choose a
            project, then select the branch whose behavior you want to explore.
          </p>
          {session.installationUrl && (
            <p>
              <a
                href={session.installationUrl}
                target="_blank"
                rel="noreferrer"
              >
                Install or manage repository access on GitHub ↗
              </a>
            </p>
          )}
          {error && (
            <div role="alert" className="notice error">
              {error}
            </div>
          )}
          {!repositories && !error && (
            <p role="status">Checking your repository access…</p>
          )}
          {repositories?.length === 0 && (
            <section className="section-card">
              <h2>No authorized repositories yet</h2>
              <p>
                Install this host's GitHub App and select the repositories you
                need. For an organization, ask an owner to approve the
                installation. Return here and refresh after approval.
              </p>
            </section>
          )}
          <div className="repo-grid">
            {repositories?.slice(0, visible).map((repo) => (
              <ProjectCard
                key={`${revision}:${repo.id}`}
                repository={repo}
                session={session}
                onChange={() => setRevision((value) => value + 1)}
              />
            ))}
          </div>
          {repositories && repositories.length > visible && (
            <button onClick={() => setVisible((value) => value + 12)}>
              Show more projects
            </button>
          )}
        </>
      )}
    </main>
  );
}
function ProjectCard({
  repository: repo,
  session,
  onChange,
}: {
  repository: RepositoryInfo;
  session: SessionInfo;
  onChange: () => void;
}) {
  const [status, setStatus] = useState("Not checked");
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    if (!repo.disconnected)
      void schedule(async () => {
        if (!controller.signal.aborted) await check(controller.signal);
      });
    return () => controller.abort();
  }, [repo.id, repo.disconnected, repo.selectedBranch]);
  async function check(signal?: AbortSignal) {
    setStatus("Checking…");
    setError("");
    try {
      const snapshot = await api<Snapshot>(
        `/repositories/${repo.fullName}/snapshot?ref=${encodeURIComponent(repo.selectedBranch)}`,
        { signal },
      );
      if (signal?.aborted) return;
      setStatus(
        snapshot.status === "missing"
          ? "Setup needed"
          : snapshot.fallback
            ? "Previous map available; repair needed"
            : `${snapshot.status} map · ${snapshot.freshness.status.replaceAll("-", " ")}`,
      );
    } catch (error) {
      if (signal?.aborted) return;
      setStatus("Check failed");
      setError(message(error));
    }
  }
  async function connection() {
    try {
      await api(
        `/repositories/${repo.fullName}/${repo.disconnected ? "reconnect" : "disconnect"}`,
        { method: "POST", csrf: session.csrf },
      );
      onChange();
    } catch (error) {
      setError(message(error));
    }
  }
  return (
    <section className="repo-card">
      <h2>{repo.fullName}</h2>
      <p>
        {repo.private ? "Private" : "Public"} · Branch: {repo.selectedBranch}
      </p>
      <span className="badge">
        {repo.disconnected ? "Disconnected" : status}
      </span>
      {repo.lastVisitedAt && (
        <p>Last visited: {new Date(repo.lastVisitedAt).toLocaleString()}</p>
      )}
      <div className="toolbar">
        {!repo.disconnected && (
          <>
            <a
              className="primary button-link"
              href={`#/project/${repo.fullName}?ref=${encodeURIComponent(repo.selectedBranch)}`}
            >
              Open project →
            </a>
            <button
              onClick={() => {
                void schedule(() => check());
              }}
            >
              Check map
            </button>
          </>
        )}
        <button onClick={connection}>
          {repo.disconnected ? "Reconnect" : "Disconnect"}
        </button>
      </div>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
    </section>
  );
}

let activeChecks = 0;
const waitingChecks: (() => void)[] = [];
async function schedule(task: () => Promise<void>): Promise<void> {
  if (activeChecks >= 3)
    await new Promise<void>((resolve) => waitingChecks.push(resolve));
  activeChecks++;
  try {
    await task();
  } finally {
    activeChecks--;
    waitingChecks.shift()?.();
  }
}
