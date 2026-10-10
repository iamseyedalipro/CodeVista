import type { FlowBundle, FlowNode, FlowProcess } from "./types.js";

/** Find a bounded shortest breadcrumb path. Shared subprocesses may have several paths. */
export function processPath(
  bundle: FlowBundle,
  target: string,
): string[] | null {
  const processes = new Map(
    bundle.processes.map((process) => [process.id, process]),
  );
  const parents = new Map<string, string | null>();
  const queue = [...bundle.manifest.rootProcessIds];
  for (const id of queue) parents.set(id, null);
  for (let index = 0; index < queue.length; index++) {
    const id = queue[index]!;
    if (id === target) {
      const path: string[] = [];
      let current: string | null = id;
      while (current !== null) {
        path.unshift(current);
        current = parents.get(current) ?? null;
      }
      return path;
    }
    for (const node of processes.get(id)?.nodes ?? []) {
      if (node.kind === "subprocess" && !parents.has(node.processId)) {
        parents.set(node.processId, id);
        queue.push(node.processId);
      }
    }
  }
  return null;
}

export function validTrail(bundle: FlowBundle, path: string[]): boolean {
  if (!path.length) return true;
  if (
    new Set(path).size !== path.length ||
    !bundle.manifest.rootProcessIds.includes(path[0]!)
  )
    return false;
  const processes = new Map(
    bundle.processes.map((process) => [process.id, process]),
  );
  return path.every(
    (id, index) =>
      processes.has(id) &&
      (index === 0 ||
        processes
          .get(path[index - 1]!)
          ?.nodes.some(
            (node) => node.kind === "subprocess" && node.processId === id,
          )),
  );
}

export interface SearchResult {
  processId: string;
  nodeId?: string;
  title: string;
  location: string;
  path: string[];
}
export function searchFlows(bundle: FlowBundle, query: string): SearchResult[] {
  const needle = query.trim().normalize("NFKC").toLocaleLowerCase();
  if (!needle) return [];
  const results: SearchResult[] = [];
  const matches = (text: string): boolean =>
    text.normalize("NFKC").toLocaleLowerCase().includes(needle);
  for (const process of bundle.processes) {
    const path = processPath(bundle, process.id);
    if (!path) continue;
    const location = path
      .map((id) => bundle.processes.find((item) => item.id === id)?.title ?? id)
      .join(" / ");
    if (matches(process.title))
      results.push({
        processId: process.id,
        title: process.title,
        location,
        path,
      });
    for (const node of process.nodes) {
      if (matches(node.title))
        results.push({
          processId: process.id,
          nodeId: node.id,
          title: node.title,
          location,
          path,
        });
    }
  }
  return results;
}

export function adjacentNodes(process: FlowProcess, id: string): Set<string> {
  const ids = new Set([id]);
  for (const edge of process.edges)
    if (edge.from === id || edge.to === id) {
      ids.add(edge.from);
      ids.add(edge.to);
    }
  return ids;
}

export function nodeCaption(node: FlowNode): string {
  return node.kind === "end"
    ? `End · ${node.outcome.replaceAll("_", " ")}`
    : node.kind;
}
