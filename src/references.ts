import type { CodeReference, SnapshotContext } from "./types.js";

/** Reject ambiguous paths; these are literal Git paths, not URLs or encoded paths. */
export function isRepositoryPath(path: string): boolean {
  return path.length > 0 && path.length <= 1024 &&
    !/[\\\u0000-\u001f\u007f:%?#]/u.test(path) &&
    !path.startsWith("/") &&
    path.split("/").every(part => part.length > 0 && part !== "." && part !== ".." && part !== ".git");
}

export function isLineRange(reference: CodeReference): boolean {
  const { startLine, endLine } = reference;
  return (startLine === undefined || (Number.isSafeInteger(startLine) && startLine >= 1)) &&
    (endLine === undefined || (startLine !== undefined && Number.isSafeInteger(endLine) && endLine >= startLine));
}

/** Build a link only at the reader's immutable revision; this does not authorize access. */
export function codeReferenceUrl(reference: CodeReference, snapshot: SnapshotContext): string {
  const { repository, commitSha } = snapshot;
  if (repository.host !== "github.com" ||
      !/^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/.test(repository.owner) ||
      !/^[A-Za-z0-9_.-]{1,100}$/.test(repository.name) ||
      repository.name === "." || repository.name === ".." ||
      !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(commitSha) ||
      !isRepositoryPath(reference.path) || !isLineRange(reference)) {
    throw new Error("A safe repository path, line range, repository, and full immutable commit SHA are required.");
  }
  const path = reference.path.split("/").map(encodeURIComponent).join("/");
  const lines = reference.startLine === undefined ? "" :
    `#L${reference.startLine}${reference.endLine === undefined ? "" : `-L${reference.endLine}`}`;
  return `https://github.com/${repository.owner}/${repository.name}/blob/${commitSha}/${path}${lines}`;
}
