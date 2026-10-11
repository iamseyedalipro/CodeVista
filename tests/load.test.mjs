import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdtemp, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { FILE_LIMITS, loadFlowDirectory } from "../dist/src/load.js";

async function temporaryMap(t) {
  const directory = await mkdtemp(join(tmpdir(), "codevista-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const root = join(directory, "map");
  await cp(new URL("../examples/reference/after", import.meta.url), root, { recursive: true });
  return { directory, root };
}

test("loads declared process files without altering any content", async t => {
  const { root } = await temporaryMap(t);
  const before = await readFile(join(root, "processes/login.json"), "utf8");
  const result = await loadFlowDirectory(root);
  assert.equal(result.valid, true);
  assert.equal(result.bundle.processes.length, 8);
  assert.equal(await readFile(join(root, "processes/login.json"), "utf8"), before);
});

const mutations = [
  ["missing process", "READ_FAILED", root => rm(join(root, "processes/login.json"))],
  ["missing manifest", "READ_FAILED", root => rm(join(root, "manifest.json"))],
  ["malformed JSON", "INVALID_JSON", root => writeFile(join(root, "manifest.json"), '{"schemaVersion":')],
  ["invalid UTF-8", "INVALID_JSON", root => writeFile(join(root, "manifest.json"), Buffer.from([0xff, 0xfe]))],
  ["oversized file", "RESOURCE_LIMIT", root => writeFile(join(root, "manifest.json"), " ".repeat(FILE_LIMITS.perFileBytes + 1))],
  ["mismatched document identity", "PROCESS_ID_MISMATCH", async root => {
    const path = join(root, "processes/login.json");
    const document = JSON.parse(await readFile(path, "utf8"));
    document.id = "imposter";
    await writeFile(path, JSON.stringify(document));
  }],
  ["path traversal in the manifest", "INVALID_STRUCTURE", async root => {
    const path = join(root, "manifest.json");
    const manifest = JSON.parse(await readFile(path, "utf8"));
    manifest.processes[0].file = "../secret.json";
    await writeFile(path, JSON.stringify(manifest));
  }],
  ["noncanonical declared filename", "NONCANONICAL_FILE", async root => {
    const path = join(root, "manifest.json");
    const manifest = JSON.parse(await readFile(path, "utf8"));
    manifest.processes[0].file = "processes/other.json";
    await writeFile(path, JSON.stringify(manifest));
  }],
];
for (const [name, code, mutate] of mutations) {
  test(`directory loading rejects ${name}`, async t => {
    const { root } = await temporaryMap(t);
    await mutate(root);
    const result = await loadFlowDirectory(root);
    assert.equal(result.valid, false);
    assert.equal(result.diagnostics[0].code, code, JSON.stringify(result));
    assert.equal("bundle" in result, false);
    assert.ok(!JSON.stringify(result).includes(root));
  });
}

test("file, directory, and root symlinks are rejected", async t => {
  const { root, directory } = await temporaryMap(t);
  const secret = join(directory, "secret.json");
  await writeFile(secret, '{"private":"should never be disclosed"}');
  await rm(join(root, "processes/login.json"));
  await symlink(secret, join(root, "processes/login.json"));
  const fileResult = await loadFlowDirectory(root);
  assert.equal(fileResult.valid, false);
  assert.equal(fileResult.diagnostics[0].code, "UNSAFE_FILE");
  assert.ok(!JSON.stringify(fileResult).includes("should never be disclosed"));
  await rename(join(root, "processes"), join(directory, "actual-processes"));
  await symlink(join(directory, "actual-processes"), join(root, "processes"), "dir");
  assert.equal((await loadFlowDirectory(root)).diagnostics[0].code, "UNSAFE_FILE");
  const link = join(directory, "linked-map");
  await symlink(root, link, "dir");
  assert.equal((await loadFlowDirectory(link)).diagnostics[0].code, "UNSAFE_FILE");
});

test("the combined byte budget is enforced even when individual files fit", async t => {
  const { root } = await temporaryMap(t);
  const manifest = JSON.parse(await readFile(join(root, "manifest.json"), "utf8"));
  for (const entry of manifest.processes) {
    const path = join(root, entry.file);
    const data = await readFile(path, "utf8");
    await writeFile(path, data.padEnd(FILE_LIMITS.perFileBytes, " "));
  }
  const result = await loadFlowDirectory(root);
  assert.equal(result.valid, false);
  assert.equal(result.diagnostics[0].code, "RESOURCE_LIMIT");
});

test("CLI success, invalid map, and usage errors have distinct exit codes", async t => {
  const { root } = await temporaryMap(t);
  const cli = new URL("../dist/src/cli.js", import.meta.url);
  const run = args => spawnSync(process.execPath, [cli.pathname, ...args], { encoding: "utf8" });
  const valid = run([root, "--json"]);
  assert.equal(valid.status, 0, valid.stderr);
  const report = JSON.parse(valid.stdout);
  assert.equal(report.valid, true);
  assert.equal(report.assurance, "structure-only");
  assert.ok(report.diagnostics.some(item => item.severity === "warning"));
  assert.equal(run(["--help"]).status, 0);
  assert.equal(run(["--unknown"]).status, 2);
  assert.equal(run([root, root]).status, 2);
  await rm(join(root, "manifest.json"));
  const invalid = run([root, "--json"]);
  assert.equal(invalid.status, 1);
  assert.equal(JSON.parse(invalid.stdout).valid, false);
});
