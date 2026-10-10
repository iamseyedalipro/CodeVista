import { useEffect, useMemo, useState } from "react";
import type { FlowBundle, FlowNode, SnapshotContext } from "../src/types";
import { codeReferenceUrl } from "../src/references";
import { processPath, searchFlows, validTrail } from "../src/viewer";
import { FlowCanvas } from "./FlowCanvas";

export function Viewer({
  bundle,
  scope,
  trail,
  selectedId,
  navigate,
  source,
  unavailable = [],
  invalidReferences = [],
}: {
  bundle: FlowBundle;
  scope: string;
  trail: string[];
  selectedId: string | null;
  navigate: (trail: string[], node?: string) => void;
  source?: SnapshotContext;
  unavailable?: string[];
  invalidReferences?: string[];
}) {
  const [search, setSearch] = useState<string | null>(null);
  const process = bundle.processes.find((item) => item.id === trail.at(-1));
  const selected = process?.nodes.find((node) => node.id === selectedId);
  const results = useMemo(
    () => searchFlows(bundle, search ?? ""),
    [bundle, search],
  );
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSearch(null);
      if (
        event.key === "/" &&
        !(
          event.target instanceof HTMLInputElement ||
          event.target instanceof HTMLTextAreaElement
        )
      ) {
        event.preventDefault();
        setSearch("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const missing =
    trail.length > 0 &&
    (!validTrail(bundle, trail) ||
      !process ||
      unavailable.includes(process.id));
  function open(id: string) {
    navigate([...trail, id]);
  }
  return (
    <div className="viewer">
      <aside className="process-nav">
        <div className="nav-label">APPLICATION MAP</div>
        <button
          className={!trail.length ? "nav-item active" : "nav-item"}
          onClick={() => navigate([])}
        >
          ◈ <span>Overview</span>
        </button>
        {bundle.manifest.rootProcessIds.map((id) => {
          const root = bundle.processes.find((item) => item.id === id);
          return (
            <button
              key={id}
              className={trail[0] === id ? "nav-item active" : "nav-item"}
              onClick={() => navigate([id])}
            >
              <span className="nav-dot" />
              <span dir="auto">{root?.title ?? id}</span>
              {root?.behavior !== "implemented" && (
                <small>{root?.behavior ?? "unavailable"}</small>
              )}
            </button>
          );
        })}
        <div className="sidebar-note">
          <span className="status-dot" />
          Repository-owned flows
          <p>
            Your code. Your agent.
            <br />
            Your map stays with you.
          </p>
        </div>
      </aside>
      <main className="workspace">
        <div className="workspace-bar">
          <nav aria-label="Breadcrumb">
            <button onClick={() => navigate([])}>Overview</button>
            {trail.map((id, index) => (
              <span key={id}>
                {" "}
                /{" "}
                <button onClick={() => navigate(trail.slice(0, index + 1))}>
                  {bundle.processes.find((item) => item.id === id)?.title ??
                    "Unavailable process"}
                </button>
              </span>
            ))}
          </nav>
          <button className="search-trigger" onClick={() => setSearch("")}>
            ⌕ <span>Find a process or step</span>
            <kbd>/</kbd>
          </button>
        </div>
        {missing ? (
          <div className="empty">
            <div className="empty-symbol">?</div>
            <h2>Process unavailable</h2>
            <p>
              This path is missing or invalid in the selected version. No
              different version has been substituted.
            </p>
            <button className="primary" onClick={() => navigate([])}>
              Return to overview
            </button>
          </div>
        ) : process ? (
          <>
            <div className="process-heading">
              <div>
                <button
                  className="back"
                  onClick={() => navigate(trail.slice(0, -1))}
                >
                  ← Back one level
                </button>
                <h1 dir="auto">{process.title}</h1>
                <p dir="auto">{process.purpose}</p>
              </div>
              <span className={`badge ${process.coverage.status}`}>
                {process.behavior === "implemented"
                  ? process.coverage.status
                  : process.behavior}
              </span>
            </div>
            {selectedId && !selected && (
              <div className="notice compact error" role="alert">
                This step is unavailable in the selected version. Select another
                step or inspect the previous version.
              </div>
            )}
            {process.coverage.gaps.length > 0 && (
              <div className="notice compact">
                <strong>Coverage gaps</strong>
                {process.coverage.gaps.map((gap) => (
                  <span dir="auto" key={gap}>
                    {gap}
                  </span>
                ))}
              </div>
            )}
            {!process.nodes.length ? (
              <div className="empty">
                <div className="empty-symbol">◇</div>
                <h2>This area has not been reviewed</h2>
                <p>
                  No steps have been invented. Ask your existing coding agent to
                  inspect this process.
                </p>
              </div>
            ) : (
              <div className="diagram-row">
                {process.nodes.length <= 500 ? (
                  <FlowCanvas
                    process={process}
                    scope={scope}
                    selected={selectedId}
                    onSelect={(id) => navigate(trail, id ?? undefined)}
                    onOpen={open}
                  />
                ) : (
                  <section className="large-process">
                    <h2>Large process · {process.nodes.length} steps</h2>
                    <p>
                      The diagram limit is 500 steps per process. Search still
                      opens every step and its outgoing paths. Ask your agent to
                      extract meaningful subprocesses for a readable diagram.
                    </p>
                    <button onClick={() => setSearch("")}>Find a step</button>
                    {process.nodes.slice(0, 50).map((node) => (
                      <button
                        key={node.id}
                        onClick={() => navigate(trail, node.id)}
                      >
                        {node.title}
                      </button>
                    ))}
                    <p>
                      Showing the first 50 steps. Use search to reach the rest.
                    </p>
                  </section>
                )}
                {selected && (
                  <aside className="details" aria-label="Step details">
                    <div className="detail-top">
                      <span className="eyebrow">STEP DETAILS</span>
                      <button
                        aria-label="Close details"
                        onClick={() => navigate(trail)}
                      >
                        ×
                      </button>
                    </div>
                    <h2 dir="auto">{selected.title}</h2>
                    <span className="badge">
                      {selected.kind} · {selected.behavior}
                    </span>
                    <p className="description" dir="auto">
                      {selected.description}
                    </p>
                    {selected.kind === "subprocess" && (
                      <button
                        className="primary full"
                        onClick={() => open(selected.processId)}
                      >
                        Open subprocess ↗
                      </button>
                    )}
                    {selected.kind === "end" && (
                      <div className="detail-section">
                        <h3>Outcome</h3>
                        <p>{selected.outcome.replaceAll("_", " ")}</p>
                      </div>
                    )}
                    <div className="detail-section">
                      <h3>Outgoing paths</h3>
                      {process.edges
                        .filter((edge) => edge.from === selected.id)
                        .map((edge) => (
                          <button
                            className="path-card"
                            key={edge.id}
                            onClick={() => navigate(trail, edge.to)}
                          >
                            <strong dir="auto">{edge.label} →</strong>
                            <span dir="auto">
                              {edge.condition ?? "Continue to the next step"}
                            </span>
                            <small>{edge.kind}</small>
                          </button>
                        ))}
                      {!process.edges.some(
                        (edge) => edge.from === selected.id,
                      ) && <p>No outgoing path.</p>}
                    </div>
                    <Evidence
                      node={selected}
                      source={source}
                      invalidReferences={invalidReferences}
                    />
                  </aside>
                )}
              </div>
            )}
          </>
        ) : (
          <section className="overview">
            <div className="eyebrow">THE BIG PICTURE</div>
            <div className="overview-heading">
              <div>
                <h1>Understand what happens.</h1>
                <p>Explore the application one process at a time.</p>
              </div>
              <span className="overview-count">
                {bundle.manifest.rootProcessIds.length}
                <small>main processes</small>
              </span>
            </div>
            <div className="metric-strip">
              <span>
                <strong>{bundle.processes.length}</strong> processes
              </span>
              <span>
                <strong>
                  {bundle.processes.reduce(
                    (sum, item) => sum + item.nodes.length,
                    0,
                  )}
                </strong>{" "}
                documented steps
              </span>
              <span>
                <strong>{bundle.manifest.coverage.status}</strong> coverage
              </span>
            </div>
            <div className="process-grid">
              {bundle.manifest.rootProcessIds.map((id, index) => {
                const item = bundle.processes.find((item) => item.id === id);
                return (
                  <button
                    key={id}
                    className="process-card"
                    onClick={() => navigate([id])}
                  >
                    <div className="card-top">
                      <span className="process-icon">
                        {["↪", "◇", "☷", "▥", "✦"][index % 5]}
                      </span>
                      <span className="card-arrow">↗</span>
                    </div>
                    <h2 dir="auto">{item?.title ?? id}</h2>
                    <p dir="auto">
                      {item?.purpose ??
                        "This process is unavailable in the current map."}
                    </p>
                    <div className="card-bottom">
                      <span>{item?.nodes.length ?? 0} steps</span>
                      <span className="badge">
                        {unavailable.includes(id)
                          ? "unavailable"
                          : item?.behavior === "implemented"
                            ? item.coverage.status
                            : (item?.behavior ?? "unknown")}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
            {bundle.manifest.relationships.length > 0 && (
              <section className="relationships">
                <h2>How processes connect</h2>
                {bundle.manifest.relationships.map((link) => (
                  <div key={link.id}>
                    <button
                      onClick={() =>
                        navigate(processPath(bundle, link.from) ?? [])
                      }
                    >
                      {bundle.processes.find((p) => p.id === link.from)?.title}
                    </button>
                    <span> → {link.label} → </span>
                    <button
                      onClick={() =>
                        navigate(processPath(bundle, link.to) ?? [])
                      }
                    >
                      {bundle.processes.find((p) => p.id === link.to)?.title}
                    </button>
                    <p>{link.description}</p>
                  </div>
                ))}
              </section>
            )}
            <div className="overview-footer">
              <strong>Read the map with context.</strong> Structural validity,
              review freshness, and coverage are separate. A diagram is
              documented behavior, not proof of successful execution.
            </div>
          </section>
        )}
      </main>
      {search !== null && (
        <div className="modal-backdrop" onClick={() => setSearch(null)}>
          <section
            className="search-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Search flows"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="search-input">
              <span>⌕</span>
              <input
                autoFocus
                placeholder="Search processes and steps…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <button onClick={() => setSearch(null)}>Close</button>
            </div>
            <div className="search-results">
              {!search.trim() ? (
                <p>
                  Search by a process or step title. Every result opens its
                  exact location.
                </p>
              ) : !results.length ? (
                <p>No matching processes or steps.</p>
              ) : (
                <>
                  {results.length > 250 && (
                    <p>
                      Showing 250 of {results.length} matches. Refine your
                      search.
                    </p>
                  )}
                  {results.slice(0, 250).map((result, index) => (
                    <button
                      key={`${result.processId}:${result.nodeId ?? index}`}
                      onClick={() => {
                        navigate(result.path, result.nodeId);
                        setSearch(null);
                      }}
                    >
                      <strong dir="auto">{result.title}</strong>
                      <span dir="auto">{result.location}</span>
                    </button>
                  ))}
                </>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function Evidence({
  node,
  source,
  invalidReferences,
}: {
  node: FlowNode;
  source?: SnapshotContext;
  invalidReferences: string[];
}) {
  return (
    <div className="detail-section">
      <h3>Source evidence</h3>
      <span className="badge">
        {node.evidence.kind === "code"
          ? "Code reference supplied"
          : node.evidence.kind}
      </span>
      {"reason" in node.evidence && <p dir="auto">{node.evidence.reason}</p>}
      {node.evidence.references.map((reference, index) => {
        const missing = invalidReferences.includes(reference.path);
        let href: string | undefined;
        try {
          if (source && !missing) href = codeReferenceUrl(reference, source);
        } catch {
          /* A malformed source must remain plain text. */
        }
        return (
          <div key={index} className="source-ref">
            {href ? (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {reference.path} ↗
              </a>
            ) : (
              <code>{reference.path}</code>
            )}
            {reference.symbol && <small>{reference.symbol}</small>}
            {missing && (
              <small className="error-text">
                Source unavailable at this revision.
              </small>
            )}
          </div>
        );
      })}
      <p className="muted small">
        A reference is evidence to inspect, not a verification badge.
      </p>
    </div>
  );
}
