export interface TreeEntry {
  path: string;
  mode: string;
  type: string;
  sha: string;
}
export interface ReviewReceipt {
  schemaVersion: "1.0.0";
  sourceDigest: string;
  mapDigest: string;
  reviewedAt: string;
  result: "updated" | "no-flow-change";
  note: string;
}
export interface Freshness {
  status: "reviewed" | "needs-review" | "not-recorded" | "unverifiable";
  reason: string;
  reviewedAt?: string;
  result?: ReviewReceipt["result"];
}
