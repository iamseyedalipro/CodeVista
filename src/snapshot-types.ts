import type { Diagnostic, FlowBundle, SnapshotContext } from "./types.js";
import type { Freshness } from "./review-types.js";
import type { FlowChange } from "./diff.js";

export interface Snapshot {
  repository: string;
  ref: string;
  selectedSha: string;
  displayedSha: string;
  receivedAt: string;
  status: "valid" | "degraded" | "invalid" | "missing";
  bundle?: FlowBundle;
  source: SnapshotContext;
  freshness: Freshness;
  diagnostics: Diagnostic[];
  unavailable: string[];
  invalidReferences: string[];
  fallback: boolean;
}
export interface Comparison {
  number: number;
  title: string;
  baseRef: string;
  headRef: string;
  state: "open" | "closed" | "merged";
  base: Snapshot;
  head: Snapshot;
  changes: FlowChange[] | null;
}
