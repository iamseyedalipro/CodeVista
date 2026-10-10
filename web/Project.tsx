import { useEffect, useState } from "react";
import { Viewer } from "./Viewer";
import { api, message, type SessionInfo } from "./api";
import type { Comparison, Snapshot } from "../src/snapshot-types";
import { processPath } from "../src/viewer";

export function Project({
  repository,
  hash,
  session,
}: {
  repository: string;
  hash: string;
  session: SessionInfo;
}) {
  const params = new URLSearchParams(hash.split("?")[1]);
  const ref = params.get("ref") ?? "";
  const pr = params.get("pr");
  const side = params.get("side") === "base" ? "base" : "head";
  const trail = params.get("trail")?.split(",").filter(Boolean) ?? [];
  const selected = params.get("node");
  const [loaded, setLoaded] = useState<{
    key: string;
    snapshot: Snapshot;
    comparison?: Comparison;
  } | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [verified, setVerified] = useState("");
  const [branches, setBranches] = useState<string[]>([]);
  const [branchPage, setBranchPage] = useState(1);
  const [moreBranches, setMoreBranches] = useState(false);
  const [pulls, setPulls] = useState<
    { number: number; title: string; state: string }[]
  >([]);
  const [pullPage, setPullPage] = useState(1);
  const [morePulls, setMorePulls] = useState(false);
  const [controlError, setControlError] = useState("");
  const [repair, setRepair] = useState(false);
  const [copied, setCopied] = useState(false);
  const apiRoot = `/repositories/${repository}`;
  const key = `${repository}:${ref}:${pr ?? ""}:${revision}`;
  useEffect(() => {
    const controller = new AbortController();
    setLoaded(null);
    setError("");
    setRepair(false);
    setVerified("");
    const path = pr
      ? `${apiRoot}/comparison/${encodeURIComponent(pr)}`
      : `${apiRoot}/snapshot${ref ? `?ref=${encodeURIComponent(ref)}` : ""}`;
    api<Snapshot | Comparison>(path, { signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        if ("head" in result)
          setLoaded({ key, snapshot: result.head, comparison: result });
        else setLoaded({ key, snapshot: result });
        if (!pr)
          void api(`${apiRoot}/preference`, {
            method: "POST",
            csrf: session.csrf,
            body: { branch: ref || (result as Snapshot).ref },
          }).catch((error) => {
            if (!controller.signal.aborted) setControlError(message(error));
          });
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setLoaded(null);
          setError(message(error));
        }
      });
    return () => controller.abort();
  }, [key, apiRoot, ref, pr, session.csrf]);
  useEffect(() => {
    const controller = new AbortController();
    setVerified("");
    api(`${apiRoot}/access`, { signal: controller.signal })
      .then(() => {
        if (!controller.signal.aborted) setVerified(hash);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setLoaded(null);
          setError(message(error));
        }
      });
    return () => controller.abort();
  }, [hash, apiRoot, revision]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (!document.hidden) setRevision((value) => value + 1);
    }, 60000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setBranches([]);
    setPulls([]);
    setBranchPage(1);
    setPullPage(1);
    setMoreBranches(false);
    setMorePulls(false);
    Promise.all([
      api<{ branches: { name: string }[]; hasMore: boolean }>(
        `${apiRoot}/branches`,
        { signal: controller.signal },
      ).then((data) => {
        setBranches(data.branches.map((branch) => branch.name));
        setMoreBranches(data.hasMore);
      }),
      api<{
        pulls: { number: number; title: string; state: string }[];
        hasMore: boolean;
      }>(`${apiRoot}/pulls`, { signal: controller.signal }).then((data) => {
        setPulls(data.pulls);
        setMorePulls(data.hasMore);
      }),
    ]).catch((error) => {
      if (!controller.signal.aborted) setControlError(message(error));
    });
    return () => controller.abort();
  }, [apiRoot]);
  async function more(kind: "branches" | "pulls") {
    try {
      if (kind === "branches") {
        const data = await api<{
          branches: { name: string }[];
          hasMore: boolean;
        }>(`${apiRoot}/branches?page=${branchPage + 1}`);
        setBranches((values) => [
          ...new Set([...values, ...data.branches.map((item) => item.name)]),
        ]);
        setBranchPage((value) => value + 1);
        setMoreBranches(data.hasMore);
      } else {
        const data = await api<{
          pulls: { number: number; title: string; state: string }[];
          hasMore: boolean;
        }>(`${apiRoot}/pulls?page=${pullPage + 1}`);
        setPulls((values) => [
          ...new Map(
            [...values, ...data.pulls].map((item) => [item.number, item]),
          ).values(),
        ]);
        setPullPage((value) => value + 1);
        setMorePulls(data.hasMore);
      }
    } catch (error) {
      setControlError(message(error));
    }
  }
  function route(next: URLSearchParams) {
    location.hash = `/project/${repository}?${next}`;
  }
  function navigate(path: string[], node?: string) {
    const next = new URLSearchParams(params);
    next.delete("trail");
    next.delete("node");
    if (path.length) next.set("trail", path.join(","));
    if (node) next.set("node", node);
    route(next);
  }
  const current = loaded?.key === key ? loaded : null;
  const snapshot = current?.comparison
    ? current.comparison[side]
    : current?.snapshot;
  const visible = snapshot && verified === hash;
  return (
    <>
      <div className="project-toolbar toolbar">
        <a href="#/projects">← Projects</a>
        <label>
          Branch{" "}
          <select
            aria-label="Repository branch"
            value={ref || snapshot?.ref || ""}
            onChange={(event) =>
              route(new URLSearchParams({ ref: event.target.value }))
            }
          >
            <option value={ref || snapshot?.ref || ""}>
              {ref || snapshot?.ref || "Default branch"}
            </option>
            {branches
              .filter((branch) => branch !== (ref || snapshot?.ref))
              .map((branch) => (
                <option key={branch}>{branch}</option>
              ))}
          </select>
        </label>
        {moreBranches && (
          <button onClick={() => void more("branches")}>More branches</button>
        )}
        <label>
          Pull request{" "}
          <select
            aria-label="Pull request"
            value={pr ?? ""}
            onChange={(event) =>
              route(
                new URLSearchParams({
                  ref: ref || snapshot?.ref || "",
                  ...(event.target.value ? { pr: event.target.value } : {}),
                }),
              )
            }
          >
            <option value="">Branch view</option>
            {pr && !pulls.some((item) => String(item.number) === pr) && (
              <option value={pr}>#{pr}</option>
            )}
            {pulls.map((item) => (
              <option key={item.number} value={item.number}>
                #{item.number} · {item.state} · {item.title}
              </option>
            ))}
          </select>
        </label>
        {morePulls && (
          <button onClick={() => void more("pulls")}>More pull requests</button>
        )}
        <button onClick={() => setRevision((value) => value + 1)}>
          Refresh
        </button>
        <button
          onClick={() => {
            void navigator.clipboard
              .writeText(location.href)
              .then(() => setCopied(true))
              .catch(() =>
                setControlError(
                  "Copy the page URL from your browser to share this location.",
                ),
              );
          }}
        >
          {copied ? "Link copied" : "Copy deep link"}
        </button>
      </div>
      {controlError && (
        <div className="notice error" role="alert">
          {controlError}
        </div>
      )}
      {error ? (
        <div className="empty">
          <h2>Project view unavailable</h2>
          <p role="alert">{error}</p>
          <button onClick={() => setRevision((value) => value + 1)}>
            Retry
          </button>
          <p>
            <a href="#/projects">Check access in Projects</a>
          </p>
        </div>
      ) : !visible ? (
        <div className="empty" role="status">
          <h2>Checking access and loading this version…</h2>
          <p>No other repository or branch is being substituted.</p>
        </div>
      ) : (
        <>
          <div className="version-strip">
            <span className="status-dot" />
            <strong>{snapshot.repository}</strong>
            <span>{pr ? `Pull request #${pr} · ${side}` : snapshot.ref}</span>
            <span>Selected {snapshot.selectedSha.slice(0, 12)}</span>
            <span>Displayed {snapshot.displayedSha.slice(0, 12)}</span>
            <span className="version-note">
              Checked {new Date(snapshot.receivedAt).toLocaleTimeString()}
            </span>
          </div>
          {current?.comparison && (
            <section className="changes-panel">
              <div className="row">
                <h2>
                  #{current.comparison.number}: {current.comparison.title}
                </h2>
                <span className="badge">{current.comparison.state}</span>
              </div>
              <p className="small">
                Target branch: {current.comparison.baseRef}. Source branch:{" "}
                {current.comparison.headRef}. Comparison:{" "}
                {current.comparison.base.displayedSha.slice(0, 12)} →{" "}
                {current.comparison.head.displayedSha.slice(0, 12)}. Reviewing
                this pull request does not change the base branch.
              </p>
              <div className="tabs">
                <button
                  aria-pressed={side === "head"}
                  onClick={() => {
                    const next = new URLSearchParams(params);
                    next.set("side", "head");
                    next.delete("trail");
                    next.delete("node");
                    route(next);
                  }}
                >
                  Proposed version
                </button>
                <button
                  aria-pressed={side === "base"}
                  onClick={() => {
                    const next = new URLSearchParams(params);
                    next.set("side", "base");
                    next.delete("trail");
                    next.delete("node");
                    route(next);
                  }}
                >
                  Previous version
                </button>
              </div>
              {current.comparison.changes === null ? (
                <div className="notice">
                  A complete comparison is unavailable because one version has a
                  missing or invalid map. No deletions have been inferred.
                </div>
              ) : (
                <details>
                  <summary>
                    {current.comparison.changes.length} documented changes
                  </summary>
                  {current.comparison.changes.map((change) => (
                    <details key={`${change.entity}:${change.id}`}>
                      <summary>
                        {change.kind} {change.entity}: {change.title}
                        {change.fields.length
                          ? ` (${change.fields.join(", ")})`
                          : ""}
                      </summary>
                      <div className="toolbar">
                        {(["before", "after"] as const).map((version) => {
                          const target =
                            version === "before"
                              ? current.comparison!.base.bundle
                              : current.comparison!.head.bundle;
                          const id =
                            version === "before"
                              ? change.previousProcessId
                              : change.processId;
                          if (!target || !id || !change[version]) return null;
                          return (
                            <button
                              key={version}
                              onClick={() => {
                                const path = processPath(target, id);
                                if (!path) return;
                                const next = new URLSearchParams(params);
                                next.set(
                                  "side",
                                  version === "before" ? "base" : "head",
                                );
                                next.set("trail", path.join(","));
                                next.delete("node");
                                if (change.entity === "node")
                                  next.set("node", change.id);
                                route(next);
                              }}
                            >
                              Inspect{" "}
                              {version === "before" ? "previous" : "proposed"}{" "}
                              location
                            </button>
                          );
                        })}
                      </div>
                      <strong>Previous</strong>
                      <pre>
                        {JSON.stringify(change.before ?? null, null, 2)}
                      </pre>
                      <strong>Proposed</strong>
                      <pre>{JSON.stringify(change.after ?? null, null, 2)}</pre>
                    </details>
                  ))}
                </details>
              )}
            </section>
          )}
          {snapshot.status !== "missing" && (
            <div className="snapshot-notices">
              <div className={`notice ${snapshot.fallback ? "error" : ""}`}>
                <strong>
                  {snapshot.fallback
                    ? "Showing a previous valid map"
                    : `Structure: ${snapshot.status}`}
                </strong>
                <p>
                  Review: {snapshot.freshness.status.replaceAll("-", " ")}.{" "}
                  {snapshot.freshness.reason}
                </p>
                {snapshot.freshness.reviewedAt && (
                  <p>
                    Review recorded{" "}
                    {new Date(snapshot.freshness.reviewedAt).toLocaleString()}
                    {snapshot.freshness.result
                      ? ` · ${snapshot.freshness.result.replaceAll("-", " ")}`
                      : ""}
                    .
                  </p>
                )}
                {snapshot.bundle && (
                  <p>
                    Coverage: {snapshot.bundle.manifest.coverage.status}.{" "}
                    {snapshot.bundle.manifest.coverage.scope}
                  </p>
                )}
                {(snapshot.freshness.status !== "reviewed" ||
                  snapshot.bundle?.manifest.coverage.status !== "complete") && (
                  <button onClick={() => setRepair(true)}>
                    Get recovery prompt
                  </button>
                )}
              </div>
              {snapshot.diagnostics.some(
                (item) => item.severity === "error",
              ) && (
                <details className="notice error">
                  <summary>Map errors and repair</summary>
                  {snapshot.diagnostics
                    .filter((item) => item.severity === "error")
                    .map((issue, index) => (
                      <p key={index}>
                        <code>{issue.path}</code>: {issue.message}
                      </p>
                    ))}
                  <button onClick={() => setRepair(true)}>
                    Get recovery prompt
                  </button>
                </details>
              )}
            </div>
          )}
          {(snapshot.status === "missing" ||
            snapshot.status === "invalid" ||
            repair) && (
            <Setup
              apiRoot={`/repositories/${snapshot.repository}`}
              branch={
                current?.comparison
                  ? side === "base"
                    ? current.comparison.baseRef
                    : current.comparison.headRef
                  : ref || snapshot.ref
              }
              recovery={snapshot.status !== "missing"}
              onRefresh={() => setRevision((value) => value + 1)}
            />
          )}
          {snapshot.bundle && (
            <Viewer
              key={`${repository}:${ref}:${pr ?? ""}:${side}`}
              bundle={snapshot.bundle}
              scope={`${repository}:${ref}:${pr ?? ""}:${side}`}
              trail={trail}
              selectedId={selected}
              navigate={navigate}
              source={snapshot.source}
              unavailable={snapshot.unavailable}
              invalidReferences={snapshot.invalidReferences}
            />
          )}
        </>
      )}
    </>
  );
}
function Setup({
  apiRoot,
  branch,
  recovery,
  onRefresh,
}: {
  apiRoot: string;
  branch: string;
  recovery: boolean;
  onRefresh: () => void;
}) {
  const [language, setLanguage] = useState("en");
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setPrompt("");
    setError("");
    setCopied(false);
    api<{ prompt: string }>(
      `${apiRoot}/prompt?${new URLSearchParams({ ref: branch, language, mode: recovery ? "recovery" : "setup" })}`,
      { signal: controller.signal },
    )
      .then((result) => setPrompt(result.prompt))
      .catch((error) => {
        if (!controller.signal.aborted) setError(message(error));
      });
    return () => controller.abort();
  }, [apiRoot, branch, language, recovery]);
  return (
    <section className="panel">
      <div className="section-card">
        <h2>
          {recovery
            ? "Repair this map with your coding agent"
            : "Create the first application map"}
        </h2>
        <p>
          Copy this prompt into the coding agent you already use with this
          repository. Keep working in branch <strong>{branch}</strong>. Existing
          definitions and instructions must be preserved.
        </p>
        <div className="toolbar">
          <label>
            Map content language{" "}
            <select
              aria-label="Map content language"
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
            >
              <option value="en">English</option>
              <option value="fa">Persian</option>
            </select>
          </label>
          <a href="/agent/logicatlas-kit.zip" download>
            Download agent kit
          </a>
        </div>
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
        {prompt && (
          <>
            <textarea
              className="prompt-text full"
              aria-label="Agent prompt"
              readOnly
              value={prompt}
              rows={12}
            />
            <div className="toolbar">
              <button
                className="primary"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(prompt)
                    .then(() => setCopied(true))
                    .catch(() =>
                      setError("Select and copy the prompt text above."),
                    );
                }}
              >
                {copied ? "Prompt copied" : "Copy prompt"}
              </button>
              <button onClick={onRefresh}>
                I published the changes · Check again
              </button>
            </div>
          </>
        )}
        <p>
          Only published GitHub changes can be checked. LogicAtlas cannot
          observe local work or the progress of your agent session. You can
          leave and return to this branch at any time.
        </p>
      </div>
    </section>
  );
}
