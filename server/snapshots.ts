import { validateManifest, validateProcess } from "../src/schema.js";
import { validateBundle } from "../src/validate.js";
import { assessFreshness } from "../src/review.js";
import { compareFlows } from "../src/diff.js";
import type { FlowProcess, Manifest } from "../src/types.js";
import type { Snapshot, Comparison } from "../src/snapshot-types.js";
import type { AuthContext, createApp } from "./app.js";
import { ApiError, type GitHub, type Revision } from "./github.js";

const MAX_BYTES = 16 * 1024 * 1024;
// A one-minute cleanup timer keeps total retention below fifteen minutes.
const TTL = 14 * 60 * 1000;
function placeholder(id: string): FlowProcess {
  return {
    schemaVersion: "1.0.0",
    id,
    title: "Unavailable process",
    purpose:
      "The process document could not be safely displayed. Repair the reported map errors.",
    behavior: "unknown",
    evidence: {
      kind: "unspecified",
      references: [],
      reason: "The document is unavailable or invalid.",
    },
    coverage: {
      status: "unreviewed",
      scope: "Unavailable process content",
      gaps: ["Repair this process before reviewing its behavior."],
    },
    entryNodeId: null,
    nodes: [],
    edges: [],
  };
}
export class SnapshotService {
  private previous = new Map<
    string,
    { snapshot: Snapshot; until: number; bytes: number }
  >();
  private sequences = new Map<string, number>();
  private sequence = 0;
  constructor(private github: GitHub) {}
  clear(sessionId: string): void {
    for (const key of this.previous.keys())
      if (sessionId === "*" || key.startsWith(`${sessionId}:`))
        this.previous.delete(key);
    // Invalidate in-flight writes after logout, disconnect, or account deletion.
    for (const key of this.sequences.keys())
      if (sessionId === "*" || key.startsWith(`${sessionId}:`))
        this.sequences.delete(key);
  }
  prune(): void {
    for (const [key, value] of this.previous)
      if (value.until <= Date.now()) this.previous.delete(key);
  }
  async load(
    auth: AuthContext,
    ref: string,
    options: { fallback?: boolean; expectedRepository?: string } = {},
  ): Promise<Snapshot> {
    const key = `${auth.id}:${auth.repository.id}:${ref}`;
    const sequence = ++this.sequence;
    this.sequences.set(key, sequence);
    this.prune();
    try {
      while (this.sequences.size > 1000)
        this.sequences.delete(this.sequences.keys().next().value!);
      const revision = await this.github.resolve(
        auth.session.accessToken,
        auth.repository.full_name,
        ref,
      );
      const snapshot = await this.read(
        auth,
        ref,
        revision,
        options.expectedRepository,
      );
      if (
        snapshot.status === "valid" &&
        options.fallback !== false &&
        this.sequences.get(key) === sequence
      ) {
        const bytes = Buffer.byteLength(JSON.stringify(snapshot));
        this.previous.delete(key);
        this.previous.set(key, { snapshot, until: Date.now() + TTL, bytes });
        let total = [...this.previous.values()].reduce(
          (sum, item) => sum + item.bytes,
          0,
        );
        while (this.previous.size > 20 || total > 64 * 1024 * 1024) {
          const first = this.previous.keys().next().value!;
          total -= this.previous.get(first)!.bytes;
          this.previous.delete(first);
        }
      }
      if (
        (snapshot.status === "invalid" || snapshot.status === "degraded") &&
        options.fallback !== false
      ) {
        const old = this.previous.get(key)?.snapshot;
        if (old && old.displayedSha !== snapshot.selectedSha)
          return {
            ...old,
            selectedSha: snapshot.selectedSha,
            receivedAt: snapshot.receivedAt,
            fallback: true,
            diagnostics: snapshot.diagnostics,
            freshness: {
              status: "needs-review",
              reason:
                "Showing a previously validated map. The selected revision contains map errors; this view is not current.",
            },
          };
      }
      return snapshot;
    } finally {
      if (this.sequences.get(key) === sequence) this.sequences.delete(key);
    }
  }
  private async read(
    auth: AuthContext,
    ref: string,
    revision: Revision,
    expectedRepository = auth.repository.full_name,
  ): Promise<Snapshot> {
    const repository = auth.repository.full_name;
    const token = auth.session.accessToken;
    const [owner, name] = repository.split("/");
    const snapshot: Snapshot = {
      repository,
      ref,
      selectedSha: revision.sha,
      displayedSha: revision.sha,
      receivedAt: new Date().toISOString(),
      status: "invalid",
      source: {
        repository: { host: "github.com", owner: owner!, name: name! },
        commitSha: revision.sha,
      },
      freshness: {
        status: "unverifiable",
        reason: "A valid complete map could not be loaded.",
      },
      diagnostics: [],
      unavailable: [],
      invalidReferences: [],
      fallback: false,
    };
    const tree = await this.github.tree(token, repository, revision);
    if (tree.truncated)
      throw new ApiError(
        413,
        "TRUNCATED_TREE",
        "GitHub returned an incomplete file tree. No deletion or freshness conclusion can be made. Reduce the repository scope before retrying.",
      );
    const entries = new Map(tree.entries.map((entry) => [entry.path, entry]));
    let totalBytes = 0;
    const read = async (path: string): Promise<unknown> => {
      if (totalBytes >= MAX_BYTES)
        throw new ApiError(
          413,
          "RESOURCE_LIMIT",
          "The map exceeds the 16 MiB total budget.",
        );
      const entry = entries.get(path);
      if (!entry)
        throw new ApiError(
          422,
          "MISSING_DOCUMENT",
          "A declared map document is missing from this revision.",
        );
      if (entry.type !== "blob" || !["100644", "100755"].includes(entry.mode))
        throw new ApiError(
          422,
          "UNSAFE_DOCUMENT",
          "Map documents must be regular repository files, not links or submodules.",
        );
      if ((entry.size ?? 0) > 2 * 1024 * 1024)
        throw new ApiError(
          413,
          "RESOURCE_LIMIT",
          "A map document exceeds the 2 MiB limit.",
        );
      const result = await this.github.blob(token, repository, entry.sha);
      totalBytes += result.bytes;
      if (totalBytes > MAX_BYTES)
        throw new ApiError(
          413,
          "RESOURCE_LIMIT",
          "The map exceeds the 16 MiB total budget.",
        );
      return result.value;
    };
    const issue = (error: unknown, path: string): void => {
      if (!(error instanceof ApiError) || ![413, 422].includes(error.status))
        throw error;
      snapshot.diagnostics.push({
        severity: "error",
        code: error.code,
        path,
        message: error.message,
      });
    };
    if (!entries.has(".codevista/manifest.json")) {
      snapshot.status = "missing";
      return snapshot;
    }
    let raw: unknown;
    try {
      raw = await read(".codevista/manifest.json");
    } catch (error) {
      issue(error, "/manifest");
      return snapshot;
    }
    const manifestResult = validateManifest(raw);
    snapshot.diagnostics.push(...manifestResult.diagnostics);
    if (!manifestResult.valid) return snapshot;
    const manifest = structuredClone(raw) as Manifest;
    if (
      `${manifest.project.repository.owner}/${manifest.project.repository.name}`.toLowerCase() !==
        expectedRepository.toLowerCase() &&
      `${manifest.project.repository.owner}/${manifest.project.repository.name}`.toLowerCase() !==
        repository.toLowerCase()
    ) {
      snapshot.diagnostics.push({
        severity: "error",
        code: "REPOSITORY_MISMATCH",
        path: "/manifest/project/repository",
        message:
          "The map names a different repository. Correct its repository metadata before displaying it.",
      });
      return snapshot;
    }
    if (
      manifest.processes.some(
        (entry) => entry.file !== `processes/${entry.id}.json`,
      )
    ) {
      snapshot.diagnostics.push({
        severity: "error",
        code: "NONCANONICAL_FILE",
        path: "/manifest/processes",
        message:
          "Use processes/<stable-process-id>.json for every process document.",
      });
      return snapshot;
    }
    const processes: FlowProcess[] = new Array(manifest.processes.length);
    let index = 0;
    const unavailable = new Set<string>();
    await Promise.all(
      Array.from(
        { length: Math.min(4, manifest.processes.length) },
        async () => {
          while (index < manifest.processes.length) {
            const current = index++;
            const entry = manifest.processes[current]!;
            try {
              const value = await read(`.codevista/${entry.file}`);
              const result = validateProcess(value, `/processes/${current}`);
              if (!result.valid || (value as FlowProcess).id !== entry.id) {
                snapshot.diagnostics.push(...result.diagnostics, {
                  severity: "error",
                  code: "INVALID_PROCESS",
                  path: `/processes/${current}`,
                  message:
                    "Repair this process using its declared stable identity and schema.",
                });
                unavailable.add(entry.id);
                processes[current] = placeholder(entry.id);
              } else processes[current] = value as FlowProcess;
            } catch (error) {
              issue(error, `/processes/${current}`);
              unavailable.add(entry.id);
              processes[current] = placeholder(entry.id);
            }
          }
        },
      ),
    );
    if (totalBytes > MAX_BYTES) return snapshot;
    const downgradeCoverage = (): void => {
      manifest.coverage = {
        ...manifest.coverage,
        status: "partial",
        gaps: [
          ...manifest.coverage.gaps,
          "Some process documents are unavailable. This is a partial view, not a repaired map.",
        ],
      };
    };
    if (unavailable.size) downgradeCoverage();
    // Quarantine only identified process failures. Ambiguous global failures suppress the whole map.
    for (let attempt = 0; attempt <= processes.length; attempt++) {
      const result = validateBundle(manifest, processes);
      if (result.valid) {
        snapshot.status = unavailable.size ? "degraded" : "valid";
        snapshot.bundle = { manifest, processes };
        snapshot.diagnostics.push(...result.diagnostics);
        break;
      }
      const errors = result.diagnostics.filter(
        (item) => item.severity === "error",
      );
      snapshot.diagnostics.push(...errors);
      const affected = new Set<number>();
      for (const error of errors) {
        const match = /^\/processes\/(\d+)(?:\/|$)/.exec(error.path);
        if (
          !match ||
          ["DUPLICATE_ID", "RESOURCE_LIMIT", "REPORT_LIMIT"].includes(
            error.code,
          )
        )
          return snapshot;
        affected.add(Number(match[1]));
      }
      let changed = false;
      for (const position of affected) {
        const process = processes[position];
        if (process && !unavailable.has(process.id)) {
          unavailable.add(process.id);
          processes[position] = placeholder(process.id);
          changed = true;
        }
      }
      if (!changed) return snapshot;
      downgradeCoverage();
    }
    snapshot.unavailable = [...unavailable];
    snapshot.diagnostics = snapshot.diagnostics.slice(0, 200);
    if (!snapshot.bundle) return snapshot;
    const references = snapshot.bundle.processes
      .flatMap((process) => [
        process.evidence,
        ...process.nodes.map((node) => node.evidence),
      ])
      .flatMap((evidence) => evidence.references);
    snapshot.invalidReferences = [
      ...new Set(
        references
          .filter((reference) => {
            const entry = entries.get(reference.path);
            return (
              !entry ||
              entry.type !== "blob" ||
              !["100644", "100755"].includes(entry.mode)
            );
          })
          .map((reference) => reference.path),
      ),
    ];
    let receipt: unknown = null;
    if (entries.has(".codevista/review.json")) {
      try {
        receipt = await read(".codevista/review.json");
      } catch (error) {
        issue(error, "/review");
        receipt = {};
      }
    }
    snapshot.freshness =
      snapshot.status === "valid"
        ? assessFreshness(receipt, snapshot.bundle, tree.entries)
        : {
            status: "unverifiable",
            reason:
              "One or more process documents could not be validated. Repair the map before recording a review.",
          };
    return snapshot;
  }
}
export function registerSnapshots(
  service: Awaited<ReturnType<typeof createApp>>,
): SnapshotService {
  const snapshots = new SnapshotService(service.github);
  service.clearPrivate.add((id) => snapshots.clear(id));
  const timer = setInterval(() => snapshots.prune(), 60000);
  timer.unref();
  service.app.addHook("onClose", async () => {
    clearInterval(timer);
    snapshots.clear("*");
  });
  let active = 0;
  const requests = new Map<string, number>();
  service.app.addHook("preHandler", async (request, reply) => {
    if (!/\/(snapshot|comparison\/[^/?]+)(?:\?|$)/.test(request.url)) return;
    const session = await service.sessionFor(request.cookies);
    const count = requests.get(session.id) ?? 0;
    if (active >= 16 || count >= 4)
      throw new ApiError(
        429,
        "BUSY",
        "Too many map requests are in progress. Retry shortly.",
      );
    active++;
    requests.set(session.id, count + 1);
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      active--;
      const next = (requests.get(session.id) ?? 1) - 1;
      if (next <= 0) requests.delete(session.id);
      else requests.set(session.id, next);
    };
    reply.raw.once("finish", release);
    reply.raw.once("close", release);
  });
  service.app.get<{
    Params: { owner: string; repo: string };
    Querystring: { ref?: string };
  }>("/api/repositories/:owner/:repo/snapshot", async (request) => {
    const auth = await service.authorize(
      request.cookies,
      `${request.params.owner}/${request.params.repo}`,
    );
    const snapshot = await snapshots.load(
      auth,
      request.query.ref ?? auth.repository.default_branch,
    );
    const current = service.store.get(auth.id);
    if (!current || current.disconnected.includes(auth.repository.id))
      throw new ApiError(
        401,
        "SIGN_IN_REQUIRED",
        "Your session or project access changed. Sign in again.",
      );
    return snapshot;
  });
  service.app.get<{ Params: { owner: string; repo: string; number: string } }>(
    "/api/repositories/:owner/:repo/comparison/:number",
    async (request) => {
      const auth = await service.authorize(
        request.cookies,
        `${request.params.owner}/${request.params.repo}`,
      );
      const number = Number(request.params.number);
      if (!Number.isSafeInteger(number) || number < 1)
        throw new ApiError(
          400,
          "INVALID_PULL_REQUEST",
          "Choose a valid pull request number.",
        );
      const pr = await service.github.pull(
        auth.session.accessToken,
        auth.repository.full_name,
        number,
      );
      if (!pr.head.repo)
        throw new ApiError(
          404,
          "HEAD_UNAVAILABLE",
          "The pull request source repository is no longer available. No deletion comparison can be made.",
        );
      const headAuth =
        pr.head.repo.id === auth.repository.id
          ? auth
          : await service.authorize(request.cookies, pr.head.repo.full_name);
      const [base, head] = await Promise.all([
        snapshots.load(auth, pr.base.sha, { fallback: false }),
        snapshots.load(headAuth, pr.head.sha, {
          fallback: false,
          expectedRepository: auth.repository.full_name,
        }),
      ]);
      const current = service.store.get(auth.id);
      if (
        !current ||
        current.disconnected.includes(auth.repository.id) ||
        current.disconnected.includes(headAuth.repository.id)
      )
        throw new ApiError(
          401,
          "SIGN_IN_REQUIRED",
          "Your session or project access changed. Sign in again.",
        );
      const changes =
        base.status === "valid" &&
        head.status === "valid" &&
        base.bundle &&
        head.bundle
          ? compareFlows(base.bundle, head.bundle)
          : null;
      return {
        number,
        title: pr.title,
        baseRef: pr.base.ref,
        headRef: pr.head.ref,
        state: pr.merged ? "merged" : pr.state === "open" ? "open" : "closed",
        base,
        head,
        changes,
      } satisfies Comparison;
    },
  );
  return snapshots;
}
