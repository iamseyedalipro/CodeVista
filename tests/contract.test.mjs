import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { asFlowBundle, codeReferenceUrl, validateBundle, validateManifest, validateProcess } from "../dist/src/index.js";
import { fixture, nodeById, processById } from "./helpers.mjs";

const validate = bundle => validateBundle(bundle.manifest, bundle.processes);
const expectCode = (result, code) => {
  assert.equal(result.valid, false, JSON.stringify(result));
  assert.ok(result.diagnostics.some(item => item.severity === "error" && item.code === code), JSON.stringify(result));
};

for (const variant of ["before", "after"]) {
  test(`${variant} reference map validates without hiding known gaps`, async () => {
    const bundle = await fixture(variant);
    const result = validate(bundle);
    assert.equal(result.valid, true, JSON.stringify(result));
    assert.ok(result.diagnostics.some(item => item.code === "INCOMPLETE_COVERAGE"));
    assert.ok(result.diagnostics.some(item => item.code === "NON_CURRENT_BEHAVIOR"));
    assert.deepEqual(asFlowBundle(bundle.manifest, bundle.processes), bundle);
  });
}

test("schema versions fail closed with an explicit migration instruction", async () => {
  const bundle = await fixture();
  bundle.manifest.schemaVersion = "2.0.0";
  expectCode(validate(bundle), "UNSUPPORTED_VERSION");
  assert.match(validate(bundle).diagnostics[0].message, /migrate/);
  assert.throws(() => asFlowBundle(bundle.manifest, bundle.processes), /Invalid flow bundle/);
  bundle.manifest.schemaVersion = "1.0.0";
  bundle.processes[0].schemaVersion = "1.1.0";
  expectCode(validate(bundle), "UNSUPPORTED_VERSION");
});

test("unknown fields and styling instructions cannot silently alter the portable contract", async () => {
  const bundle = await fixture();
  bundle.processes[0].nodes[0].color = "green";
  expectCode(validate(bundle), "INVALID_STRUCTURE");
});

test("process and step renaming preserve all identities and references", async () => {
  const bundle = await fixture();
  const original = structuredClone(bundle);
  processById(bundle, "subscription").title = "Check active access";
  nodeById(bundle, "subscription", "subscription.check").title = "Is access active?";
  assert.equal(validate(bundle).valid, true);
  assert.deepEqual(bundle.manifest, original.manifest);
  for (let index = 0; index < bundle.processes.length; index++) {
    assert.equal(bundle.processes[index].id, original.processes[index].id);
    assert.deepEqual(bundle.processes[index].edges, original.processes[index].edges);
    assert.deepEqual(bundle.processes[index].nodes.map(node => [node.id, node.processId]), original.processes[index].nodes.map(node => [node.id, node.processId]));
  }
});

test("reference changes preserve unrelated process files byte for byte", async () => {
  for (const id of ["subscription", "analytics", "translation"]) {
    const before = await readFile(new URL(`../examples/reference/before/processes/${id}.json`, import.meta.url));
    const after = await readFile(new URL(`../examples/reference/after/processes/${id}.json`, import.meta.url));
    assert.deepEqual(after, before);
  }
  const before = await fixture("before");
  const after = await fixture("after");
  for (const id of ["login", "payment", "chat"]) {
    const next = processById(after, id);
    for (const old of processById(before, id).nodes) assert.ok(next.nodes.some(node => node.id === old.id));
    for (const old of processById(before, id).edges) assert.ok(next.edges.some(edge => edge.id === old.id));
  }
});

test("one subscription definition is shared by chat and discount eligibility", async () => {
  const bundle = await fixture();
  assert.equal(bundle.processes.filter(process => process.id === "subscription").length, 1);
  assert.equal(nodeById(bundle, "chat", "chat.subscription").processId, "subscription");
  assert.equal(nodeById(bundle, "eligibility", "eligibility.check").processId, "subscription");
  assert.equal(nodeById(bundle, "payment", "payment.discount").processId, "discount");
  assert.equal(nodeById(bundle, "discount", "discount.eligibility").processId, "eligibility");
  assert.equal(validate(bundle).valid, true);
});

test("real control-flow retry cycles are accepted", async () => {
  const bundle = await fixture();
  assert.ok(processById(bundle, "login").edges.some(edge => edge.kind === "retry" && edge.to === "login.remaining"));
  assert.equal(validate(bundle).valid, true);
});

test("direct and indirect subprocess cycles are rejected", async () => {
  const bundle = await fixture();
  nodeById(bundle, "chat", "chat.subscription").processId = "chat";
  expectCode(validate(bundle), "HIERARCHY_CYCLE");
  const indirect = await fixture();
  const check = nodeById(indirect, "subscription", "subscription.check");
  check.kind = "subprocess";
  check.processId = "chat";
  expectCode(validate(indirect), "HIERARCHY_CYCLE");
});

test("deep hierarchies are iterative and not limited to three levels", async () => {
  const bundle = await fixture();
  const template = processById(bundle, "translation");
  const count = 600;
  bundle.manifest.rootProcessIds = ["level-0"];
  bundle.manifest.processes = [];
  bundle.processes = [];
  for (let index = 0; index < count; index++) {
    const process = structuredClone(template);
    process.id = `level-${index}`;
    process.entryNodeId = `${process.id}.start`;
    process.nodes[0].id = process.entryNodeId;
    process.nodes[1].id = `${process.id}.end`;
    process.edges[0] = { id: `${process.id}.first`, from: process.entryNodeId, to: `${process.id}.end`, kind: "normal", label: "Continue" };
    if (index < count - 1) {
      process.nodes.push({ id: `${process.id}.child`, title: "Open child", description: "Open the next level.", kind: "subprocess", processId: `level-${index + 1}`, behavior: "planned", evidence: process.evidence });
      process.edges[0].to = `${process.id}.child`;
      process.edges.push({ id: `${process.id}.last`, from: `${process.id}.child`, to: `${process.id}.end`, kind: "normal", label: "Return" });
    }
    bundle.processes.push(process);
    bundle.manifest.processes.push({ id: process.id, file: `processes/${process.id}.json` });
  }
  assert.equal(validate(bundle).valid, true);
});

const mutations = [
  ["duplicate manifest process", "DUPLICATE_ID", bundle => bundle.manifest.processes.push(bundle.manifest.processes[0])],
  ["duplicate process document", "DUPLICATE_ID", bundle => bundle.processes.push(bundle.processes[0])],
  ["duplicate step identity", "DUPLICATE_ID", bundle => bundle.processes[0].nodes.push(bundle.processes[0].nodes[0])],
  ["duplicate edge identity", "DUPLICATE_ID", bundle => bundle.processes[0].edges.push(bundle.processes[0].edges[0])],
  ["missing process", "MISSING_PROCESS", bundle => bundle.processes.pop()],
  ["missing overview process", "MISSING_ROOT", bundle => bundle.manifest.rootProcessIds.push("missing")],
  ["undeclared process", "UNDECLARED_PROCESS", bundle => bundle.manifest.processes.pop()],
  ["orphaned process", "ORPHAN_PROCESS", bundle => bundle.manifest.rootProcessIds = bundle.manifest.rootProcessIds.filter(id => id !== "analytics")],
  ["broken edge", "DANGLING_EDGE", bundle => bundle.processes[0].edges[0].to = "missing"],
  ["missing subprocess", "MISSING_SUBPROCESS", bundle => { nodeById(bundle, "chat", "chat.subscription").processId = "missing"; }],
  ["wrong entry", "INVALID_ENTRY", bundle => { bundle.processes[0].entryNodeId = "login.credentials"; }],
  ["unlabelled decision condition", "MISSING_CONDITION", bundle => { delete processById(bundle, "login").edges.find(edge => edge.from === "login.credentials").condition; }],
  ["duplicate branch condition", "DUPLICATE_CONDITION", bundle => { const edges = processById(bundle, "login").edges.filter(edge => edge.from === "login.credentials"); edges[1].condition = edges[0].condition; }],
  ["dead end claimed complete", "UNEXPLAINED_DEAD_END", bundle => { const p = processById(bundle, "login"); p.edges = p.edges.filter(edge => edge.from !== "login.retry"); }],
  ["future process invoked as current", "PLANNED_AS_CURRENT", bundle => { nodeById(bundle, "chat", "chat.subscription").processId = "translation"; }],
  ["future step inserted into a current path", "PLANNED_AS_CURRENT", bundle => { nodeById(bundle, "chat", "chat.allowed").behavior = "planned"; }],
  ["false complete coverage", "COVERAGE_CONFLICT", bundle => { bundle.manifest.coverage = { status: "complete", scope: "All declared processes", gaps: [] }; }],
  ["invented unreviewed steps", "INVENTED_PLACEHOLDER", bundle => { processById(bundle, "analytics").nodes.push(bundle.processes[0].nodes[0]); }],
  ["noncanonical filename", "NONCANONICAL_FILE", bundle => { bundle.manifest.processes[0].file = "processes/other.json"; }],
  ["reversed source lines", "INVALID_LINE_RANGE", bundle => { bundle.processes[0].evidence.references[0].startLine = 20; bundle.processes[0].evidence.references[0].endLine = 2; }],
  ["unsupported repository host", "INVALID_STRUCTURE", bundle => { bundle.manifest.project.repository.host = "attacker.example"; }],
  ["absolute source URL", "UNSAFE_REFERENCE", bundle => { bundle.processes[0].evidence.references[0].path = "https://example.com/source.ts"; }],
];
for (const [name, code, mutate] of mutations) {
  test(`rejects ${name}`, async () => {
    const bundle = await fixture();
    mutate(bundle);
    expectCode(validate(bundle), code);
  });
}

test("an explicit unknown continuation is allowed only with a coverage gap", async () => {
  const bundle = await fixture();
  const process = processById(bundle, "login");
  process.edges = process.edges.filter(edge => edge.from !== "login.retry");
  process.coverage = { status: "partial", scope: "Login", gaps: ["Retry continuation has not been inspected."] };
  const result = validate(bundle);
  assert.equal(result.valid, true);
  assert.ok(result.diagnostics.some(item => item.code === "UNKNOWN_CONTINUATION"));
});

test("code-backed, inferred, and missing evidence remain distinct", async () => {
  const bundle = await fixture();
  const node = bundle.processes[0].nodes[0];
  node.evidence = { kind: "inference", reason: "Entry inferred from the caller; review still required.", references: node.evidence.references };
  assert.equal(validate(bundle).valid, true);
  node.evidence = { kind: "code", references: [] };
  expectCode(validate(bundle), "INVALID_STRUCTURE");
  node.evidence = { kind: "unspecified", references: [] };
  expectCode(validate(bundle), "INVALID_STRUCTURE");
});

test("all reference evidence resolves to an included fixture source and symbol", async () => {
  const bundle = await fixture();
  for (const process of bundle.processes) {
    for (const entity of [process, ...process.nodes]) {
      assert.ok(entity.evidence.kind === "code" || entity.evidence.reason);
      for (const reference of entity.evidence.references) {
        const source = await readFile(new URL(`../${reference.path}`, import.meta.url), "utf8");
        assert.ok(source.includes(`function ${reference.symbol}(`), reference.symbol);
      }
    }
  }
});

test("Unicode content is preserved without translating identifiers or source paths", async () => {
  const bundle = await fixture();
  const title = "\u0648\u0631\u0648\u062f / Sign in";
  bundle.processes[0].title = title;
  bundle.manifest.project.contentLanguage = "fa";
  const before = JSON.stringify(bundle);
  assert.equal(validate(bundle).valid, true);
  assert.equal(JSON.stringify(bundle), before);
});

test("validation never mutates existing definitions, including on failure", async () => {
  const bundle = await fixture();
  bundle.processes[0].nodes[0].extra = "untrusted";
  const before = JSON.stringify(bundle);
  assert.equal(validate(bundle).valid, false);
  assert.equal(JSON.stringify(bundle), before);
});

test("arbitrary HTML is inert data and is never interpolated into diagnostics", async () => {
  const bundle = await fixture();
  const hostile = "<script>throw new Error('must not run')</script>";
  bundle.processes[0].title = hostile;
  assert.equal(validate(bundle).valid, true);
  bundle.processes[0][hostile] = true;
  const result = validate(bundle);
  assert.equal(result.valid, false);
  assert.ok(!JSON.stringify(result).includes(hostile));
});

test("standalone schemas reject malformed documents and missing required evidence", async () => {
  for (const value of [null, [], false, 12, "not a map", {}]) {
    assert.equal(validateManifest(value).valid, false);
    assert.equal(validateProcess(value).valid, false);
  }
  const bundle = await fixture();
  delete bundle.processes[0].nodes[0].evidence;
  expectCode(validate(bundle), "INVALID_STRUCTURE");
  expectCode(validateBundle({}, Array(1001).fill({})), "RESOURCE_LIMIT");
  expectCode(validateBundle({}, null), "RESOURCE_LIMIT");
});

const snapshot = { repository: { host: "github.com", owner: "example", name: "private-repo" }, commitSha: "a".repeat(40) };
test("source links use the exact supplied commit, encoded paths, and line range", () => {
  assert.equal(codeReferenceUrl({ path: "src/some file.ts", startLine: 3, endLine: 9 }, snapshot), `https://github.com/example/private-repo/blob/${"a".repeat(40)}/src/some%20file.ts#L3-L9`);
  assert.throws(() => codeReferenceUrl({ path: "src/code.ts" }, { ...snapshot, commitSha: "main" }));
  assert.throws(() => codeReferenceUrl({ path: "src/code.ts", startLine: 10, endLine: 3 }, snapshot));
  assert.throws(() => codeReferenceUrl({ path: "src/code.ts", endLine: 3 }, snapshot));
  assert.throws(() => codeReferenceUrl({ path: "src/code.ts" }, { ...snapshot, repository: { ...snapshot.repository, host: "attacker.example" } }));
});

for (const path of ["../secret", "/etc/passwd", "a/../b", "a//b", "a/./b", "a\\b", "a/%2e%2e/b", "javascript:alert(1)", "a?token=secret", "a#fragment", ".git/config", "a\u0000b"]) {
  test(`rejects unsafe reference path ${JSON.stringify(path)}`, async () => {
    assert.throws(() => codeReferenceUrl({ path }, snapshot));
    const bundle = await fixture();
    bundle.processes[0].evidence.references[0].path = path;
    expectCode(validate(bundle), "UNSAFE_REFERENCE");
  });
}
