import { compareFlows } from "../src/diff";
import { processPath } from "../src/viewer";
import { sample } from "./samples";
const before = sample("before");
const after = sample("after");
const changes = compareFlows(before, after);
export function DemoComparison() {
  return (
    <section className="changes-panel">
      <h2>Reference change preview</h2>
      <p className="small">
        Synthetic before/after versions: a sign-in fix, discounts, and
        background chat processing. This is an example comparison, not a live
        GitHub pull request.
      </p>
      <details>
        <summary>{changes.length} documented changes</summary>
        {changes.map((change) => (
          <details key={`${change.entity}:${change.id}`}>
            <summary>
              {change.kind} {change.entity}: {change.title}
              {change.fields.length ? ` (${change.fields.join(", ")})` : ""}
            </summary>
            <div className="toolbar">
              {(["before", "after"] as const).map((version) => {
                const bundle = version === "before" ? before : after;
                const id =
                  version === "before"
                    ? change.previousProcessId
                    : change.processId;
                if (!id || !change[version]) return null;
                const trail = processPath(bundle, id);
                if (!trail) return null;
                const query = new URLSearchParams({
                  compare: "1",
                  trail: trail.join(","),
                  ...(change.entity === "node" ? { node: change.id } : {}),
                });
                return (
                  <a key={version} href={`#/demo/${version}?${query}`}>
                    Inspect {version === "before" ? "previous" : "proposed"}{" "}
                    location →
                  </a>
                );
              })}
            </div>
            <strong>Previous</strong>
            <pre>{JSON.stringify(change.before ?? null, null, 2)}</pre>
            <strong>Proposed</strong>
            <pre>{JSON.stringify(change.after ?? null, null, 2)}</pre>
          </details>
        ))}
      </details>
    </section>
  );
}
