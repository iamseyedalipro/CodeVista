import assert from "node:assert/strict";
import test from "node:test";
import {
  appendMaintenance,
  setupPrompt,
  recoveryPrompt,
} from "../dist/src/agent.js";
import {
  assessFreshness,
  sourceDigest,
  mapDigest,
} from "../dist/src/review.js";
import { fixture } from "./helpers.mjs";

const entries = [
  { path: "src/app.ts", mode: "100644", type: "blob", sha: "a".repeat(40) },
];
test("agent maintenance installation is additive and idempotent", () => {
  const original = "# Existing rules\nKeep all original instructions.\n";
  const once = appendMaintenance(original);
  assert.ok(once.startsWith(original.trimEnd()));
  assert.equal(appendMaintenance(once), once);
  assert.match(once, /no-flow-change/);
});
test("setup and recovery prompts bind repository, branch, language, and existing agent", () => {
  const context = {
    repository: "sample/project",
    branch: "develop",
    language: "English",
    kitUrl: "https://example.test/agent/logicatlas-kit.zip",
  };
  const prompt = setupPrompt(context);
  for (const text of [
    "sample/project",
    "develop",
    "English",
    "without overwriting",
    "stable IDs",
    "published to GitHub",
  ])
    assert.ok(prompt.includes(text));
  assert.match(
    recoveryPrompt(context, ["Missing subprocess"]),
    /Missing subprocess/,
  );
});
test("receipt freshness binds both source and map, including no-op reviews", async () => {
  const bundle = await fixture();
  const receipt = {
    schemaVersion: "1.0.0",
    sourceDigest: sourceDigest(entries),
    mapDigest: mapDigest(bundle),
    result: "no-flow-change",
    reviewedAt: new Date().toISOString(),
    note: "Only the source comment changed.",
  };
  assert.equal(assessFreshness(receipt, bundle, entries).status, "reviewed");
  assert.equal(
    assessFreshness(receipt, bundle, [{ ...entries[0], sha: "b".repeat(40) }])
      .status,
    "needs-review",
  );
  bundle.processes[0].title = "Renamed";
  assert.equal(
    assessFreshness(receipt, bundle, entries).status,
    "needs-review",
  );
  assert.equal(assessFreshness(null, bundle, entries).status, "not-recorded");
  assert.equal(assessFreshness(receipt, bundle, null).status, "unverifiable");
});
test("map-only and receipt-only commits cannot cause an infinite freshness loop", () => {
  assert.equal(
    sourceDigest(entries),
    sourceDigest([
      ...entries,
      {
        path: ".logicatlas/review.json",
        mode: "100644",
        type: "blob",
        sha: "b".repeat(40),
      },
    ]),
  );
});
test("invalid, future, and unsupported review receipts fail closed", async () => {
  const bundle = await fixture();
  for (const receipt of [
    {
      schemaVersion: "1.0.0",
      result: "updated",
      sourceDigest: { toString: "invalid" },
      mapDigest: {},
      reviewedAt: new Date().toISOString(),
      note: "Malformed digest",
    },
    {},
    { schemaVersion: "2" },
    {
      schemaVersion: "1.0.0",
      result: "updated",
      sourceDigest: sourceDigest(entries),
      mapDigest: mapDigest(bundle),
      note: "Review",
      reviewedAt: "2100-01-01T00:00:00Z",
    },
  ])
    assert.equal(
      assessFreshness(receipt, bundle, entries).status,
      "needs-review",
    );
});
