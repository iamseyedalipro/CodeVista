/** The portable contract contains content only; a viewer owns layout and navigation state. */
export type Behavior = "implemented" | "planned" | "unknown";

export interface CodeReference {
  /** A literal, repository-relative path resolved at the loaded map's immutable revision. */
  path: string;
  symbol?: string;
  startLine?: number;
  endLine?: number;
}

export type Evidence =
  | { kind: "code"; references: CodeReference[] }
  | { kind: "inference"; references: CodeReference[]; reason: string }
  | { kind: "unspecified"; references: []; reason: string };

export interface Coverage {
  status: "complete" | "partial" | "unreviewed";
  /** Scope of this claim, never an implicit claim about all code in the repository. */
  scope: string;
  gaps: string[];
}

export interface Manifest {
  schemaVersion: "1.0.0";
  project: {
    id: string;
    name: string;
    description: string;
    contentLanguage: string;
    repository: { host: "github.com"; owner: string; name: string };
  };
  coverage: Coverage;
  /** IDs are independent of titles and remain stable across revisions. */
  rootProcessIds: string[];
  processes: { id: string; file: string }[];
  relationships: {
    id: string;
    from: string;
    to: string;
    label: string;
    description: string;
  }[];
}

interface NodeContent {
  id: string;
  title: string;
  description: string;
  behavior: Behavior;
  evidence: Evidence;
}

export type FlowNode = NodeContent & (
  | { kind: "start" | "action" | "decision" | "wait" | "external" }
  | { kind: "subprocess"; processId: string }
  | { kind: "end"; outcome: "success" | "error" | "cancel" | "unknown" | "handed_off" }
);

export interface FlowEdge {
  id: string;
  from: string;
  to: string;
  label: string;
  kind: "normal" | "success" | "error" | "cancel" | "retry" | "timeout";
  /** Required on every outgoing decision edge; describe the actual branch predicate. */
  condition?: string;
}

export interface FlowProcess {
  schemaVersion: "1.0.0";
  id: string;
  title: string;
  purpose: string;
  behavior: Behavior;
  evidence: Evidence;
  coverage: Coverage;
  /** Null only for an explicit unreviewed placeholder with no invented steps. */
  entryNodeId: string | null;
  nodes: FlowNode[];
  edges: FlowEdge[];
}

/** This context is supplied by the reader, never trusted from repository-authored data. */
export interface SnapshotContext {
  repository: Manifest["project"]["repository"];
  commitSha: string;
}

export interface FlowBundle {
  manifest: Manifest;
  processes: FlowProcess[];
}

export interface Diagnostic {
  severity: "error" | "warning";
  code: string;
  /** Document location expressed as a JSON pointer, without private values in messages. */
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  diagnostics: Diagnostic[];
}
