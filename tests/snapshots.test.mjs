import test from "node:test";
import assert from "node:assert/strict";
import {
  SnapshotService,
  registerSnapshots,
} from "../dist/server/snapshots.js";
import { compareFlows } from "../dist/src/diff.js";
import { sourceDigest, mapDigest } from "../dist/src/review.js";
import { ApiError } from "../dist/server/github.js";
import { fixture } from "./helpers.mjs";
import { createApp } from "../dist/server/app.js";
import { configFromEnv } from "../dist/server/config.js";

const sha = (char) => char.repeat(40);
async function setup() {
  const bundle = await fixture();
  bundle.manifest.project.repository = {
    host: "github.com",
    owner: "sample",
    name: "project",
  };
  const values = new Map();
  let sequence = 1;
  const entries = [];
  const add = (path, value) => {
    const id = (sequence++).toString(16).padStart(40, "0");
    values.set(id, value);
    entries.push({ path, mode: "100644", type: "blob", sha: id });
    return id;
  };
  add(".codevista/manifest.json", bundle.manifest);
  for (const process of bundle.processes)
    add(`.codevista/processes/${process.id}.json`, process);
  for (const path of new Set(
    bundle.processes
      .flatMap((process) => [
        process.evidence,
        ...process.nodes.map((node) => node.evidence),
      ])
      .flatMap((evidence) => evidence.references.map((ref) => ref.path)),
  ))
    entries.push({ path, mode: "100644", type: "blob", sha: sha("c") });
  const auth = {
    id: "session",
    session: { accessToken: "secret-token" },
    repository: {
      id: 10,
      full_name: "sample/project",
      default_branch: "develop",
    },
  };
  const github = {
    resolve: async () => ({ sha: sha("a"), treeSha: sha("b") }),
    tree: async () => ({ entries, truncated: false }),
    blob: async (_, __, id) => {
      const value = values.get(id);
      return {
        value: structuredClone(value),
        bytes: Buffer.byteLength(JSON.stringify(value)),
      };
    },
  };
  return {
    bundle,
    values,
    entries,
    add,
    auth,
    github,
    service: new SnapshotService(github),
  };
}
test("snapshots pin every document and source link to one immutable revision", async () => {
  const h = await setup();
  const result = await h.service.load(h.auth, "develop");
  assert.equal(result.status, "valid");
  assert.equal(result.source.commitSha, sha("a"));
  assert.equal(result.selectedSha, result.displayedSha);
  assert.equal(result.freshness.status, "not-recorded");
  assert.deepEqual(result.invalidReferences, []);
});
test("review freshness is independent of partial coverage and binds the loaded tree", async () => {
  const h = await setup();
  h.add(".codevista/review.json", {
    schemaVersion: "1.0.0",
    sourceDigest: sourceDigest(h.entries),
    mapDigest: mapDigest(h.bundle),
    result: "updated",
    note: "Reviewed the reference change.",
    reviewedAt: new Date().toISOString(),
  });
  const result = await h.service.load(h.auth, "develop");
  assert.equal(result.freshness.status, "reviewed");
  assert.equal(result.bundle.manifest.coverage.status, "partial");
  h.entries.find((entry) => !entry.path.startsWith(".codevista/")).sha =
    sha("d");
  assert.equal(
    (await h.service.load(h.auth, "develop")).freshness.status,
    "needs-review",
  );
});
test("a missing manifest means setup; truncated trees never imply deletion", async () => {
  const h = await setup();
  h.github.tree = async () => ({ entries: [], truncated: true });
  await assert.rejects(
    h.service.load(h.auth, "develop"),
    (error) => error.code === "TRUNCATED_TREE",
  );
  h.github.tree = async () => ({ entries: [], truncated: false });
  assert.equal((await h.service.load(h.auth, "develop")).status, "missing");
});
test("invalid independent processes are quarantined while safe processes remain visible", async () => {
  const h = await setup();
  const entry = h.entries.find((entry) =>
    entry.path.endsWith("/analytics.json"),
  );
  h.values.set(entry.sha, {
    schemaVersion: "1.0.0",
    id: "analytics",
    invalid: true,
  });
  const result = await h.service.load(h.auth, "develop");
  assert.equal(result.status, "degraded");
  assert.ok(result.unavailable.includes("analytics"));
  assert.ok(
    result.bundle.processes.find((process) => process.id === "payment").nodes
      .length > 0,
  );
  assert.equal(result.freshness.status, "unverifiable");
});
test("last valid fallback labels the displayed and selected revisions and stays branch/session isolated", async () => {
  const h = await setup();
  await h.service.load(h.auth, "develop");
  const entry = h.entries.find((entry) =>
    entry.path.endsWith("/manifest.json"),
  );
  h.values.set(entry.sha, {});
  h.github.resolve = async () => ({ sha: sha("d"), treeSha: sha("e") });
  const result = await h.service.load(h.auth, "develop");
  assert.equal(result.fallback, true);
  assert.equal(result.displayedSha, sha("a"));
  assert.equal(result.selectedSha, sha("d"));
  assert.equal(result.freshness.status, "needs-review");
  assert.equal((await h.service.load(h.auth, "other-branch")).fallback, false);
  assert.equal(
    (await h.service.load({ ...h.auth, id: "other-session" }, "develop"))
      .fallback,
    false,
  );
  h.service.clear(h.auth.id);
  assert.equal((await h.service.load(h.auth, "develop")).fallback, false);
});
test("outages do not return fallback content or turn a map into a deletion", async () => {
  const h = await setup();
  await h.service.load(h.auth, "develop");
  h.github.tree = async () => {
    throw new ApiError(503, "GITHUB_UNAVAILABLE", "Unavailable");
  };
  await assert.rejects(
    h.service.load(h.auth, "develop"),
    (error) => error.status === 503,
  );
});
test("repository mismatch, link objects, and canonical map paths fail safely", async () => {
  const h = await setup();
  h.bundle.manifest.project.repository.owner = "another";
  assert.equal((await h.service.load(h.auth, "develop")).status, "invalid");
  h.bundle.manifest.project.repository.owner = "sample";
  h.entries[0].mode = "120000";
  assert.equal((await h.service.load(h.auth, "develop")).status, "invalid");
  h.entries[0].mode = "100644";
  h.bundle.manifest.processes[0].file = "secrets.json";
  assert.equal((await h.service.load(h.auth, "develop")).status, "invalid");
});
test("missing source files disable links without claiming validated source behavior", async () => {
  const h = await setup();
  h.github.tree = async () => ({
    entries: h.entries.filter((entry) => entry.path.startsWith(".codevista/")),
    truncated: false,
  });
  const result = await h.service.load(h.auth, "develop");
  assert.equal(result.status, "valid");
  assert.ok(result.invalidReferences.length > 0);
});
test("a slower old response cannot replace the last valid version", async () => {
  const h = await setup();
  let release;
  let calls = 0;
  h.github.resolve = async () => {
    if (++calls === 1) {
      await new Promise((resolve) => {
        release = resolve;
      });
      return { sha: sha("a"), treeSha: sha("b") };
    }
    return { sha: sha("d"), treeSha: sha("e") };
  };
  const first = h.service.load(h.auth, "develop");
  const newer = await h.service.load(h.auth, "develop");
  release();
  await first;
  h.values.set(h.entries[0].sha, {});
  h.github.resolve = async () => ({ sha: sha("f"), treeSha: sha("e") });
  const result = await h.service.load(h.auth, "develop");
  assert.equal(result.displayedSha, newer.displayedSha);
});
test("clearing private state prevents in-flight requests from repopulating fallback", async () => {
  const h = await setup();
  let release;
  const original = h.github.resolve;
  h.github.resolve = async () => {
    await new Promise((resolve) => {
      release = resolve;
    });
    return original();
  };
  const pending = h.service.load(h.auth, "develop");
  h.service.clear(h.auth.id);
  release();
  await pending;
  h.github.resolve = async () => ({ sha: sha("d"), treeSha: sha("e") });
  h.values.set(h.entries[0].sha, {});
  assert.equal((await h.service.load(h.auth, "develop")).fallback, false);
});
test("every cached fallback route reauthorizes before looking up private data", async (t) => {
  const h = await setup();
  const config = configFromEnv({ DATABASE_PATH: ":memory:" });
  let allowed = true;
  h.github.authorize = async () => {
    if (!allowed) throw new ApiError(404, "NOT_ACCESSIBLE", "Unavailable");
    return h.auth.repository;
  };
  const service = await createApp(config, { github: h.github });
  t.after(() => service.app.close());
  registerSnapshots(service);
  const id = service.store.create({
    userId: 1,
    login: "person",
    accessToken: "token",
    tokenExpiresAt: Date.now() + 3600000,
    csrf: "csrf",
    disconnected: [],
    preferences: {},
  });
  const options = {
    url: "/api/repositories/sample/project/snapshot?ref=develop",
    cookies: { codevista: id },
  };
  assert.equal((await service.app.inject(options)).json().status, "valid");
  allowed = false;
  const denied = await service.app.inject(options);
  assert.equal(denied.statusCode, 404);
  assert.ok(!denied.body.includes("payment"));
  assert.equal(
    (await service.app.inject({ url: options.url })).statusCode,
    401,
  );
});
test("stable IDs distinguish rename, content change, move, add, and removal without order noise", async () => {
  const h = await setup();
  const before = h.bundle;
  const after = structuredClone(before);
  after.processes.reverse();
  after.manifest.processes.reverse();
  assert.deepEqual(compareFlows(before, after), []);
  const original = after.processes.find((process) => process.id === "login");
  original.title = "Authenticate an existing account";
  const moved = original.nodes.splice(1, 1)[0];
  after.processes.find((process) => process.id === "payment").nodes.push(moved);
  original.edges[0].condition = "Changed condition";
  original.nodes.pop();
  original.nodes.push({
    ...original.nodes[0],
    id: "new-node",
    title: "Added node",
  });
  const changes = compareFlows(before, after);
  assert.ok(
    changes.some(
      (change) =>
        change.entity === "process" &&
        change.kind === "changed" &&
        change.fields.includes("title"),
    ),
  );
  assert.ok(
    changes.some((change) => change.id === moved.id && change.kind === "moved"),
  );
  assert.ok(changes.some((change) => change.kind === "removed"));
  assert.ok(
    changes.some(
      (change) => change.id === "new-node" && change.kind === "added",
    ),
  );
  assert.ok(
    changes.some(
      (change) =>
        change.entity === "edge" && change.fields.includes("condition"),
    ),
  );
});

test("PR routes authorize forks, pin base/head, and never infer deletions from an invalid side", async (t) => {
  const h = await setup();
  const config = configFromEnv({ DATABASE_PATH: ":memory:" });
  const base = { sha: sha("a"), ref: "develop", repo: h.auth.repository };
  const head = {
    sha: sha("d"),
    ref: "feature/discount",
    repo: h.auth.repository,
  };
  let merged = false;
  let state = "open";
  let denyFork = false;
  h.github.authorize = async (_, name) => {
    if (name !== h.auth.repository.full_name && denyFork)
      throw new ApiError(404, "NOT_ACCESSIBLE", "Unavailable");
    return name === h.auth.repository.full_name
      ? h.auth.repository
      : { ...h.auth.repository, id: 11, full_name: name };
  };
  h.github.pull = async () => ({
    number: 7,
    title: "Discount change",
    state,
    merged,
    base,
    head,
  });
  const resolved = [];
  h.github.resolve = async (_, repository, ref) => {
    resolved.push([repository, ref]);
    return { sha: ref, treeSha: sha("b") };
  };
  const service = await createApp(config, { github: h.github });
  t.after(() => service.app.close());
  registerSnapshots(service);
  const id = service.store.create({
    userId: 1,
    login: "person",
    accessToken: "token",
    tokenExpiresAt: Date.now() + 3600000,
    csrf: "csrf",
    disconnected: [],
    preferences: {},
  });
  const options = {
    url: "/api/repositories/sample/project/comparison/7",
    cookies: { codevista: id },
  };
  let response = await service.app.inject(options);
  assert.equal(response.statusCode, 200);
  let result = response.json();
  assert.equal(result.baseRef, "develop");
  assert.equal(result.headRef, "feature/discount");
  assert.equal(result.base.selectedSha, sha("a"));
  assert.equal(result.head.selectedSha, sha("d"));
  assert.deepEqual(result.changes, []);
  assert.ok(resolved.every(([, ref]) => [sha("a"), sha("d")].includes(ref)));
  state = "closed";
  response = await service.app.inject(options);
  assert.equal(response.json().state, "closed");
  assert.equal(response.json().base.selectedSha, sha("a"));
  merged = true;
  response = await service.app.inject(options);
  assert.equal(response.json().state, "merged");
  head.repo = { ...h.auth.repository, id: 11, full_name: "fork/project" };
  denyFork = true;
  response = await service.app.inject(options);
  assert.equal(response.statusCode, 404);
  assert.ok(!response.body.includes("Discount change"));
  denyFork = false;
  response = await service.app.inject(options);
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().head.source.repository.owner, "fork");
  h.values.set(h.entries[0].sha, {});
  response = await service.app.inject(options);
  assert.equal(response.json().changes, null);
});
test("logout during an in-flight snapshot prevents a private response", async (t) => {
  const h = await setup();
  const config = configFromEnv({ DATABASE_PATH: ":memory:" });
  let release;
  h.github.authorize = async () => h.auth.repository;
  h.github.resolve = async () => {
    await new Promise((resolve) => {
      release = resolve;
    });
    return { sha: sha("a"), treeSha: sha("b") };
  };
  const service = await createApp(config, { github: h.github });
  t.after(() => service.app.close());
  registerSnapshots(service);
  const id = service.store.create({
    userId: 1,
    login: "person",
    accessToken: "token",
    tokenExpiresAt: Date.now() + 3600000,
    csrf: "csrf",
    disconnected: [],
    preferences: {},
  });
  const pending = service.app.inject({
    url: "/api/repositories/sample/project/snapshot",
    cookies: { codevista: id },
  });
  for (let attempt = 0; attempt < 100 && !release; attempt++)
    await new Promise((resolve) => setTimeout(resolve, 1));
  assert.ok(release);
  service.store.delete(id);
  release();
  const response = await pending;
  assert.equal(response.statusCode, 401);
  assert.ok(!response.body.includes("payment"));
});
