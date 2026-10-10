import test from "node:test";
import assert from "node:assert/strict";
import { scaleSample } from "../dist/src/scale.js";
import { validateBundle } from "../dist/src/validate.js";
import { processPath, searchFlows } from "../dist/src/viewer.js";

test("the scale fixture exceeds both plans with ten roots, 413 nodes, shared children, depth, and a retry loop", () => {
  const bundle = scaleSample();
  const start = performance.now();
  const result = validateBundle(bundle.manifest, bundle.processes);
  assert.equal(result.valid, true, JSON.stringify(result.diagnostics));
  assert.equal(bundle.manifest.rootProcessIds.length, 10);
  assert.equal(
    bundle.processes.reduce(
      (total, process) => total + process.nodes.length,
      0,
    ),
    413,
  );
  assert.ok(bundle.processes[0].nodes.length > 30);
  assert.equal(processPath(bundle, "scale-leaf").length, 3);
  assert.ok(bundle.processes[0].edges.some((edge) => edge.kind === "retry"));
  assert.equal(searchFlows(bundle, "Synthetic step 40").length, 10);
  assert.ok(
    performance.now() - start < 2000,
    "Validation and search must finish within two seconds.",
  );
});
