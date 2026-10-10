import { isLineRange, isRepositoryPath } from "./references.js";
import { validateManifest, validateProcess } from "./schema.js";
import type { Diagnostic, Evidence, FlowBundle, FlowEdge, FlowProcess, Manifest, ValidationResult } from "./types.js";

export const VALIDATION_LIMITS = Object.freeze({ processes: 1000, nodes: 100000, edges: 200000, diagnostics: 200 });

/** Validate untrusted parsed JSON without fetching, executing, or rewriting repository content. */
export function validateBundle(manifestValue: unknown, processValues: unknown[]): ValidationResult {
  const diagnostics: Diagnostic[] = [];
  let hasError = false;
  const add = (severity: Diagnostic["severity"], code: string, path: string, message: string): void => {
    if (severity === "error") hasError = true;
    if (diagnostics.length < VALIDATION_LIMITS.diagnostics) diagnostics.push({ severity, code, path, message });
  };
  const error = (code: string, path: string, message: string): void => add("error", code, path, message);
  const warning = (code: string, path: string, message: string): void => add("warning", code, path, message);
  const finish = (): ValidationResult => {
    // An error must remain visible even if warnings filled the report first.
    if (hasError && !diagnostics.some(item => item.severity === "error")) {
      diagnostics[diagnostics.length - 1] = {
        severity: "error", code: "REPORT_LIMIT", path: "/",
        message: "Additional structural errors exist. Fix reported issues and validate again.",
      };
    }
    return { valid: !hasError, diagnostics };
  };

  if (!Array.isArray(processValues) || processValues.length > VALIDATION_LIMITS.processes) {
    error("RESOURCE_LIMIT", "/processes", "Supply an array of at most 1000 process documents.");
    return finish();
  }
  const manifestResult = validateManifest(manifestValue);
  for (const item of manifestResult.diagnostics) add(item.severity, item.code, item.path, item.message);
  let totalNodes = 0;
  let totalEdges = 0;
  processValues.forEach((value, index) => {
    const result = validateProcess(value, `/processes/${index}`);
    for (const item of result.diagnostics) add(item.severity, item.code, item.path, item.message);
    if (result.valid) {
      const process = value as FlowProcess;
      totalNodes += process.nodes.length;
      totalEdges += process.edges.length;
    }
  });
  if (totalNodes > VALIDATION_LIMITS.nodes || totalEdges > VALIDATION_LIMITS.edges) {
    error("RESOURCE_LIMIT", "/processes", "The map exceeds the documented total node or edge budget. Split the review scope explicitly.");
  }
  if (hasError) return finish();

  const manifest = manifestValue as Manifest;
  const processes = processValues as FlowProcess[];
  const byId = new Map<string, FlowProcess>();
  const declared = new Set<string>();
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();
  const children = new Map<string, Set<string>>();
  const duplicate = (ids: Set<string>, id: string, path: string): void => {
    if (ids.has(id)) error("DUPLICATE_ID", path, "Use a unique stable ID in this entity namespace; do not reuse an existing identity.");
    ids.add(id);
  };
  const checkEvidence = (evidence: Evidence, path: string): void => {
    evidence.references.forEach((reference, index) => {
      if (!isRepositoryPath(reference.path)) error("UNSAFE_REFERENCE", `${path}/references/${index}/path`, "Use a literal path inside this repository, without traversal, URL syntax, or encoded separators.");
      if (!isLineRange(reference)) error("INVALID_LINE_RANGE", `${path}/references/${index}`, "An end line must be at or after the start line.");
    });
    if (evidence.kind !== "code") warning("EVIDENCE_LIMITATION", path, "Evidence is inferred or unspecified. Preserve and display its reason; structural validation does not establish behavior.");
  };

  manifest.processes.forEach((entry, index) => {
    duplicate(declared, entry.id, `/manifest/processes/${index}/id`);
    if (entry.file !== `processes/${entry.id}.json`) error("NONCANONICAL_FILE", `/manifest/processes/${index}/file`, "Store each process in processes/<stable-process-id>.json.");
  });
  for (const [index, process] of processes.entries()) {
    if (byId.has(process.id)) error("DUPLICATE_ID", `/processes/${index}/id`, "Only one document may define a process identity.");
    byId.set(process.id, process);
    children.set(process.id, new Set());
    if (!declared.has(process.id)) error("UNDECLARED_PROCESS", `/processes/${index}/id`, "Declare this process in the manifest before including it in the map.");
  }
  for (const [index, entry] of manifest.processes.entries()) {
    if (!byId.has(entry.id)) error("MISSING_PROCESS", `/manifest/processes/${index}`, "Load the declared process from the same snapshot or explicitly mark its content as unreviewed.");
  }
  for (const [index, id] of manifest.rootProcessIds.entries()) {
    if (!byId.has(id)) error("MISSING_ROOT", `/manifest/rootProcessIds/${index}`, "The overview must refer to an existing process.");
  }
  const relationshipIds = new Set<string>();
  manifest.relationships.forEach((relationship, index) => {
    const path = `/manifest/relationships/${index}`;
    duplicate(relationshipIds, relationship.id, `${path}/id`);
    if (!manifest.rootProcessIds.includes(relationship.from) || !manifest.rootProcessIds.includes(relationship.to)) {
      error("INVALID_RELATIONSHIP", path, "Overview relationships must connect two declared overview processes.");
    }
    if (relationship.from === relationship.to) error("INVALID_RELATIONSHIP", path, "Describe a real relationship between different overview processes.");
    const from = byId.get(relationship.from);
    const to = byId.get(relationship.to);
    if (from && to && (from.behavior === "planned") !== (to.behavior === "planned")) {
      error("PLANNED_AS_CURRENT", path, "Keep planned behavior separate from the current overview's executable relationships.");
    }
  });

  if (manifest.coverage.status !== "complete") warning("INCOMPLETE_COVERAGE", "/manifest/coverage", "This map has declared gaps. Display its scope and gaps, even when its structure is valid.");
  processes.forEach((process, processIndex) => {
    const path = `/processes/${processIndex}`;
    checkEvidence(process.evidence, `${path}/evidence`);
    if (process.behavior !== "implemented") warning("NON_CURRENT_BEHAVIOR", `${path}/behavior`, "Display this process as planned or unknown, not as implemented behavior.");
    if (process.coverage.status !== "complete") {
      warning("INCOMPLETE_COVERAGE", `${path}/coverage`, "Display the declared scope and gaps for this process.");
      if (manifest.coverage.status === "complete") error("COVERAGE_CONFLICT", "/manifest/coverage", "A map containing partial or unreviewed processes cannot claim complete coverage.");
    }
    if (process.coverage.status === "unreviewed") {
      if (process.entryNodeId !== null || process.nodes.length || process.edges.length || process.behavior !== "unknown" || process.evidence.kind !== "unspecified") {
        error("INVENTED_PLACEHOLDER", path, "An unreviewed process must have unknown behavior, unspecified evidence, a null entry, and no invented nodes or edges.");
      }
      return;
    }
    const nodes = new Map(process.nodes.map(node => [node.id, node]));
    const outgoing = new Map<string, FlowEdge[]>();
    const incoming = new Set<string>();
    for (const edge of process.edges) {
      const list = outgoing.get(edge.from) ?? [];
      list.push(edge);
      outgoing.set(edge.from, list);
      incoming.add(edge.to);
    }
    const starts = process.nodes.filter(node => node.kind === "start");
    if (starts.length !== 1 || starts[0]?.id !== process.entryNodeId) {
      error("INVALID_ENTRY", `${path}/entryNodeId`, "A reviewed process must have exactly one start node matching its entry ID.");
    }
    process.nodes.forEach((node, nodeIndex) => {
      const nodePath = `${path}/nodes/${nodeIndex}`;
      duplicate(nodeIds, node.id, `${nodePath}/id`);
      checkEvidence(node.evidence, `${nodePath}/evidence`);
      if ((process.behavior === "planned") !== (node.behavior === "planned")) {
        error("PLANNED_AS_CURRENT", `${nodePath}/behavior`, "Place future steps in a separate planned process; do not mix them into current paths.");
      }
      if (node.behavior === "unknown") warning("NON_CURRENT_BEHAVIOR", `${nodePath}/behavior`, "This step's behavior is unknown; preserve that label when displaying it.");
      const next = outgoing.get(node.id) ?? [];
      if (node.kind === "start" && (incoming.has(node.id) || next.length !== 1)) error("INVALID_START", nodePath, "A start has no incoming edge and exactly one outgoing edge. Retry to an action, not the entry marker.");
      if (node.kind === "end" && next.length) error("INVALID_END", nodePath, "An end node cannot have outgoing edges; use an action or wait for continuing work.");
      if (node.kind === "decision" && next.length < 2) error("INCOMPLETE_DECISION", nodePath, "A decision needs at least two outcomes with explicit conditions.");
      if (node.kind === "decision" || next.length > 1) {
        const conditions = new Set<string>();
        for (const edge of next) {
          if (!edge.condition?.trim()) error("MISSING_CONDITION", nodePath, "Every alternative outgoing path needs an explicit condition, including fallback and error paths.");
          else if (conditions.has(edge.condition.trim())) error("DUPLICATE_CONDITION", nodePath, "Distinct branches need distinct conditions.");
          else conditions.add(edge.condition.trim());
        }
      }
      if (node.kind !== "end" && !next.length) {
        if (process.coverage.status === "complete") error("UNEXPLAINED_DEAD_END", nodePath, "Add the actual continuation or an end outcome, or mark the process partial with a gap.");
        else warning("UNKNOWN_CONTINUATION", nodePath, "The continuation is not documented. Display the process coverage gap instead of inventing a result.");
      }
      if (node.kind === "subprocess") {
        const child = byId.get(node.processId);
        if (!child) error("MISSING_SUBPROCESS", `${nodePath}/processId`, "Define the referenced subprocess once and declare it in the manifest.");
        else {
          children.get(process.id)?.add(child.id);
          if ((node.behavior === "planned") !== (child.behavior === "planned")) error("PLANNED_AS_CURRENT", nodePath, "A current path cannot invoke a planned process, or the reverse.");
        }
      }
    });
    process.edges.forEach((edge, edgeIndex) => {
      duplicate(edgeIds, edge.id, `${path}/edges/${edgeIndex}/id`);
      if (!nodes.has(edge.from) || !nodes.has(edge.to)) error("DANGLING_EDGE", `${path}/edges/${edgeIndex}`, "Connect two nodes in this process. Use a subprocess node for cross-process references.");
    });
    const reached = new Set<string>();
    const pending = process.entryNodeId === null ? [] : [process.entryNodeId];
    while (pending.length) {
      const id = pending.pop()!;
      if (reached.has(id)) continue;
      reached.add(id);
      for (const edge of outgoing.get(id) ?? []) pending.push(edge.to);
    }
    process.nodes.forEach((node, index) => {
      if (!reached.has(node.id)) error("UNREACHABLE_NODE", `${path}/nodes/${index}`, "Connect this step to the entry or remove it if the behavior no longer exists.");
    });
  });

  // Kahn's algorithm validates containment, not control flow. Real retry loops remain valid.
  const indegree = new Map([...byId.keys()].map(id => [id, 0]));
  for (const targets of children.values()) {
    for (const id of targets) indegree.set(id, (indegree.get(id) ?? 0) + 1);
  }
  const ready = [...indegree].filter(([, count]) => count === 0).map(([id]) => id);
  let visited = 0;
  while (ready.length) {
    const id = ready.pop()!;
    visited++;
    for (const child of children.get(id) ?? []) {
      const count = indegree.get(child)! - 1;
      indegree.set(child, count);
      if (count === 0) ready.push(child);
    }
  }
  if (visited !== byId.size) error("HIERARCHY_CYCLE", "/processes", "Subprocess expansion must be acyclic. Keep real retry loops inside a process's control-flow edges.");
  const visible = new Set<string>();
  const pending = [...manifest.rootProcessIds];
  while (pending.length) {
    const id = pending.pop()!;
    if (visible.has(id)) continue;
    visible.add(id);
    for (const child of children.get(id) ?? []) pending.push(child);
  }
  processes.forEach((process, index) => {
    if (!visible.has(process.id)) error("ORPHAN_PROCESS", `/processes/${index}/id`, "Expose this process in the overview or through a subprocess reference so it can be discovered.");
  });
  return finish();
}

/** Narrow a previously validated bundle at a single explicit trust boundary. */
export function asFlowBundle(manifest: unknown, processes: unknown[]): FlowBundle {
  const result = validateBundle(manifest, processes);
  if (!result.valid) throw new Error("Invalid flow bundle. Use validateBundle for actionable diagnostics.");
  return { manifest: manifest as Manifest, processes: processes as FlowProcess[] };
}
