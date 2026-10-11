import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  readFile,
  writeFile,
  mkdir,
  cp,
  rm,
  symlink,
} from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync, spawnSync } from "node:child_process";
import { unzipSync } from "fflate";
import { assessFreshness } from "../dist/src/review.js";
import { loadFlowDirectory } from "../dist/src/load.js";

test("downloaded agent kit validates and records update/no-op reviews without package installation", async () => {
  const directory = await mkdtemp(join(tmpdir(), "codevista-agent-"));
  const git = (...args) =>
    execFileSync("git", args, {
      cwd: directory,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  const run = (...args) =>
    spawnSync(process.execPath, args, { cwd: directory, encoding: "utf8" });
  const entries = () =>
    git("ls-tree", "-r", "-z", "HEAD")
      .split("\0")
      .filter(Boolean)
      .map((line) => {
        const [metadata, path] = line.split("\t");
        const [mode, type, sha] = metadata.split(" ");
        return { mode, type, sha, path };
      });
  try {
    await cp(
      resolve("examples/reference/after"),
      join(directory, ".codevista"),
      { recursive: true },
    );
    const zip = unzipSync(await readFile("public/agent/codevista-kit.zip"));
    for (const [path, bytes] of Object.entries(zip)) {
      const target = join(directory, ".codevista", path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, bytes);
    }
    git("init", "-b", "agent-review");
    git("config", "user.name", "CodeVista Test");
    git("config", "user.email", "test@example.invalid");
    await writeFile(
      join(directory, "source.ts"),
      "export const feature = true;\n",
    );
    git("add", ".");
    git("commit", "-m", "Add source and initial map");
    const validation = run(".codevista/tools/validate.mjs", ".codevista");
    assert.equal(validation.status, 0, validation.stderr);
    const review = run(
      ".codevista/tools/review.mjs",
      "--result",
      "updated",
      "--note",
      "Reviewed the implemented feature.",
    );
    assert.equal(review.status, 0, review.stderr);
    git("add", ".codevista/review.json");
    git("commit", "-m", "Record map review");
    const bundle = (await loadFlowDirectory(join(directory, ".codevista")))
      .bundle;
    let receipt = JSON.parse(
      await readFile(join(directory, ".codevista/review.json")),
    );
    assert.equal(
      assessFreshness(receipt, bundle, entries()).status,
      "reviewed",
    );
    const untouched = await readFile(
      join(directory, ".codevista/processes/payment.json"),
      "utf8",
    );
    await writeFile(
      join(directory, "source.ts"),
      "// Documentation-only change.\nexport const feature = true;\n",
    );
    assert.equal(
      run(
        ".codevista/tools/review.mjs",
        "--result",
        "no-flow-change",
        "--note",
        "Comment only.",
      ).status,
      1,
    );
    git("add", "source.ts");
    git("commit", "-m", "Document the unchanged behavior");
    assert.equal(
      assessFreshness(receipt, bundle, entries()).status,
      "needs-review",
    );
    assert.equal(
      run(
        ".codevista/tools/review.mjs",
        "--result",
        "no-flow-change",
        "--note",
        "The comment changes no behavior.",
      ).status,
      0,
    );
    receipt = JSON.parse(
      await readFile(join(directory, ".codevista/review.json")),
    );
    assert.equal(
      assessFreshness(receipt, bundle, entries()).status,
      "reviewed",
    );
    assert.equal(receipt.result, "no-flow-change");
    assert.equal(
      await readFile(
        join(directory, ".codevista/processes/payment.json"),
        "utf8",
      ),
      untouched,
    );
    await rm(join(directory, ".codevista/review.json"));
    await writeFile(join(directory, "outside.json"), "DO NOT CHANGE");
    git("add", "outside.json");
    git("commit", "-m", "Add protected test file");
    await symlink(
      "../outside.json",
      join(directory, ".codevista/review.json"),
    );
    assert.equal(
      run(
        ".codevista/tools/review.mjs",
        "--result",
        "updated",
        "--note",
        "Review.",
      ).status,
      1,
    );
    assert.equal(
      await readFile(join(directory, "outside.json"), "utf8"),
      "DO NOT CHANGE",
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
