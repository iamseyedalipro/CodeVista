import type { FlowBundle } from "./types.js";
export interface FlowChange {
  entity: "project" | "process" | "node" | "edge" | "relationship";
  id: string;
  kind: "added" | "removed" | "changed" | "moved";
  title: string;
  processId?: string;
  previousProcessId?: string;
  before?: unknown;
  after?: unknown;
  fields: string[];
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
type Entity = { value: Record<string, unknown>; processId?: string };
/** Compare stable identities, including nodes moved between processes. Never infer a deletion from an unreadable snapshot. */
export function compareFlows(
  before: FlowBundle,
  after: FlowBundle,
): FlowChange[] {
  const changes: FlowChange[] = [];
  for (const entity of [
    "project",
    "process",
    "node",
    "edge",
    "relationship",
  ] as const) {
    function collect(bundle: FlowBundle): Map<string, Entity> {
      const map = new Map<string, Entity>();
      if (entity === "project")
        map.set("project", {
          value: {
            ...bundle.manifest.project,
            coverage: bundle.manifest.coverage,
            rootProcessIds: [...bundle.manifest.rootProcessIds].sort(),
          },
        });
      if (entity === "relationship")
        for (const value of bundle.manifest.relationships)
          map.set(value.id, { value: { ...value } });
      for (const process of bundle.processes) {
        if (entity === "process") {
          const { nodes: _nodes, edges: _edges, ...value } = process;
          map.set(value.id, { value, processId: process.id });
        }
        if (entity === "node" || entity === "edge")
          for (const value of entity === "node" ? process.nodes : process.edges)
            map.set(value.id, { value: { ...value }, processId: process.id });
      }
      return map;
    }
    const previous = collect(before);
    const next = collect(after);
    for (const id of [
      ...new Set([...previous.keys(), ...next.keys()]),
    ].sort()) {
      const old = previous.get(id);
      const current = next.get(id);
      const fields =
        old && current
          ? [
              ...new Set([
                ...Object.keys(old.value),
                ...Object.keys(current.value),
              ]),
            ]
              .filter(
                (key) =>
                  canonical(old.value[key]) !== canonical(current.value[key]),
              )
              .sort()
          : [];
      if (
        old &&
        current &&
        !fields.length &&
        old.processId === current.processId
      )
        continue;
      const kind = !old
        ? "added"
        : !current
          ? "removed"
          : old.processId !== current.processId
            ? "moved"
            : "changed";
      const value = current?.value ?? old!.value;
      changes.push({
        entity,
        id,
        kind,
        title: String(value.title ?? value.label ?? value.name ?? id),
        fields,
        ...(current?.processId ? { processId: current.processId } : {}),
        ...(old?.processId ? { previousProcessId: old.processId } : {}),
        ...(old ? { before: old.value } : {}),
        ...(current ? { after: current.value } : {}),
      });
    }
  }
  return changes;
}
