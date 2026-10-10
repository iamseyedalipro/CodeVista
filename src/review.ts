import { createHash } from "node:crypto";
import type { FlowBundle } from "./types.js";

import type { TreeEntry, ReviewReceipt, Freshness } from "./review-types.js";
export type { TreeEntry, ReviewReceipt, Freshness } from "./review-types.js";

export function sourceDigest(entries: TreeEntry[]): string {
  const lines = entries
    .filter(
      (entry) =>
        (entry.type === "blob" || entry.type === "commit") &&
        !entry.path.startsWith(".logicatlas/"),
    )
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
    .map(
      (entry) => `${entry.path}\0${entry.mode}\0${entry.type}\0${entry.sha}\n`,
    )
    .join("");
  return createHash("sha256").update(lines).digest("hex");
}

export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`,
      )
      .join(",")}}`;
  return JSON.stringify(value);
}

export function mapDigest(bundle: FlowBundle): string {
  return createHash("sha256")
    .update(
      canonical({
        manifest: bundle.manifest,
        processes: [...bundle.processes].sort((a, b) =>
          a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
        ),
      }),
    )
    .digest("hex");
}

export function assessFreshness(
  receipt: unknown,
  bundle: FlowBundle,
  entries: TreeEntry[] | null,
  now = Date.now(),
): Freshness {
  if (!entries)
    return {
      status: "unverifiable",
      reason: "The source tree is incomplete. Freshness cannot be assessed.",
    };
  if (receipt === null)
    return {
      status: "not-recorded",
      reason:
        "No review receipt exists for this map. Ask your agent to review the current code.",
    };
  if (!receipt || typeof receipt !== "object")
    return {
      status: "needs-review",
      reason:
        "The review receipt is invalid. Ask your agent to record a new review.",
    };
  const r = receipt as Partial<ReviewReceipt>;
  if (
    r.schemaVersion !== "1.0.0" ||
    !["updated", "no-flow-change"].includes(r.result ?? "") ||
    typeof r.note !== "string" ||
    !r.note.trim() ||
    r.note.length > 8000 ||
    typeof r.reviewedAt !== "string" ||
    !Number.isFinite(Date.parse(r.reviewedAt)) ||
    Date.parse(r.reviewedAt) > now + 300000 ||
    typeof r.sourceDigest !== "string" ||
    typeof r.mapDigest !== "string" ||
    !/^[a-f0-9]{64}$/.test(r.sourceDigest ?? "") ||
    !/^[a-f0-9]{64}$/.test(r.mapDigest ?? "")
  )
    return {
      status: "needs-review",
      reason:
        "The review receipt is invalid. Ask your agent to record a new review.",
    };
  if (
    r.sourceDigest !== sourceDigest(entries) ||
    r.mapDigest !== mapDigest(bundle)
  )
    return {
      status: "needs-review",
      reason:
        "Source or flow content changed after the recorded review. This is a review warning, not proof that the map is wrong.",
      reviewedAt: r.reviewedAt,
    };
  return {
    status: "reviewed",
    reason:
      "A review was recorded for this exact source tree and map. This does not prove semantic accuracy or full coverage.",
    reviewedAt: r.reviewedAt,
    result: r.result!,
  };
}
