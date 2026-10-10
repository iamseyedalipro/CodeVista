import { execFileSync } from "node:child_process";
import { lstat, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { loadFlowDirectory } from "./load.js";
import { mapDigest, sourceDigest, type TreeEntry } from "./review.js";

try {
  const args = process.argv.slice(2);
  const result = args[args.indexOf("--result") + 1];
  const note = args[args.indexOf("--note") + 1];
  if (
    args.length !== 4 ||
    !args.includes("--result") ||
    !args.includes("--note") ||
    !["updated", "no-flow-change"].includes(result ?? "") ||
    !note?.trim() ||
    note.length > 8000
  )
    throw new Error(
      "Usage: node .logicatlas/tools/review.mjs --result updated|no-flow-change --note 'What was reviewed'",
    );
  const root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
  }).trim();
  if (root !== process.cwd())
    throw new Error("Run the review tool from the repository root.");
  const status = execFileSync("git", ["status", "--porcelain", "-z"], {
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean);
  if (status.some((line) => !line.slice(3).startsWith(".logicatlas/")))
    throw new Error(
      "Commit final code and instructions before recording a review. Changes outside .logicatlas remain uncommitted.",
    );
  const loaded = await loadFlowDirectory(".logicatlas");
  if (!loaded.valid)
    throw new Error(
      "The flow map is invalid. Run the validator and fix its errors before recording a review.",
    );
  const raw = execFileSync(
    "git",
    ["ls-tree", "-r", "-z", "--full-tree", "HEAD"],
    { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  );
  const entries: TreeEntry[] = raw
    .split("\0")
    .filter(Boolean)
    .map((record) => {
      const tab = record.indexOf("\t");
      const [mode, type, sha] = record.slice(0, tab).split(" ");
      return {
        mode: mode!,
        type: type!,
        sha: sha!,
        path: record.slice(tab + 1),
      };
    });
  const receipt = {
    schemaVersion: "1.0.0",
    sourceDigest: sourceDigest(entries),
    mapDigest: mapDigest(loaded.bundle),
    reviewedAt: new Date().toISOString(),
    result,
    note,
  };
  const path = ".logicatlas/review.json";
  try {
    if ((await lstat(path)).isSymbolicLink())
      throw new Error("The review receipt cannot be a symbolic link.");
  } catch (error) {
    if (!(
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ))
      throw error;
  }
  await writeFile(path, `${JSON.stringify(receipt, null, 2)}\n`, {
    flag:
      constants.O_WRONLY |
      constants.O_CREAT |
      constants.O_TRUNC |
      constants.O_NOFOLLOW,
    mode: 0o600,
  });
  console.log(
    "Review receipt recorded for the current source tree and flow content. Commit it on the same branch. This is a review claim, not proof of semantic accuracy.",
  );
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Could not record the review.",
  );
  process.exitCode = 1;
}
