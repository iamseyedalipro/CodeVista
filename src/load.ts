import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import { join, resolve } from "node:path";
import { validateManifest } from "./schema.js";
import { validateBundle } from "./validate.js";
import type { Diagnostic, FlowBundle, FlowProcess, Manifest } from "./types.js";

export const FILE_LIMITS = Object.freeze({ perFileBytes: 2 * 1024 * 1024, totalBytes: 16 * 1024 * 1024 });

export type LoadResult =
  | { valid: true; bundle: FlowBundle; diagnostics: Diagnostic[] }
  | { valid: false; diagnostics: Diagnostic[] };

class ReadFailure extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}

/** Read only declared JSON documents. Never follow links, execute code, fetch URLs, or write files. */
export async function loadFlowDirectory(directory: string): Promise<LoadResult> {
  const root = resolve(directory);
  let totalBytes = 0;
  let currentPath = "/manifest";
  const readJson = async (relativePath: string): Promise<unknown> => {
    const pieces = relativePath.split("/");
    let current = root;
    for (const [index, piece] of pieces.entries()) {
      current = join(current, piece);
      const stat = await lstat(current);
      if (stat.isSymbolicLink() || (index < pieces.length - 1 ? !stat.isDirectory() : !stat.isFile())) {
        throw new ReadFailure("UNSAFE_FILE", "Map documents and their parent directories must be regular files and directories, not symbolic links.");
      }
    }
    const file = await open(current, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const stat = await file.stat();
      if (!stat.isFile()) throw new ReadFailure("UNSAFE_FILE", "Read a regular JSON file only.");
      const budget = Math.min(FILE_LIMITS.perFileBytes, FILE_LIMITS.totalBytes - totalBytes);
      if (stat.size > budget) throw new ReadFailure("RESOURCE_LIMIT", "The map exceeds the documented file or total byte budget.");
      // Read at most budget + 1, even if a file grows after stat().
      const buffer = Buffer.alloc(budget + 1);
      let length = 0;
      while (length < buffer.length) {
        const result = await file.read(buffer, length, buffer.length - length, null);
        if (!result.bytesRead) break;
        length += result.bytesRead;
      }
      if (length > budget) throw new ReadFailure("RESOURCE_LIMIT", "The map exceeds the documented file or total byte budget.");
      totalBytes += length;
      try {
        const text = new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, length));
        return JSON.parse(text) as unknown;
      } catch {
        throw new ReadFailure("INVALID_JSON", "Use a valid UTF-8 JSON document; comments, malformed text, and trailing commas are not supported.");
      }
    } finally {
      await file.close();
    }
  };

  try {
    const rootStat = await lstat(root);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new ReadFailure("UNSAFE_FILE", "Select a map directory, not a symbolic link.");
    const manifestValue = await readJson("manifest.json");
    const checked = validateManifest(manifestValue);
    if (!checked.valid) return { valid: false, diagnostics: checked.diagnostics };
    const manifest = manifestValue as Manifest;
    const processes: unknown[] = [];
    for (const [index, entry] of manifest.processes.entries()) {
      currentPath = `/manifest/processes/${index}`;
      if (entry.file !== `processes/${entry.id}.json`) {
        throw new ReadFailure("NONCANONICAL_FILE", "Store each process in processes/<stable-process-id>.json.");
      }
      const process = await readJson(entry.file);
      if (typeof process !== "object" || process === null || !("id" in process) || process.id !== entry.id) {
        throw new ReadFailure("PROCESS_ID_MISMATCH", "The process document must define the same ID as its manifest entry and filename.");
      }
      processes.push(process);
    }
    const result = validateBundle(manifest, processes);
    if (!result.valid) return { valid: false, diagnostics: result.diagnostics };
    return { valid: true, bundle: { manifest, processes: processes as FlowProcess[] }, diagnostics: result.diagnostics };
  } catch (cause) {
    return {
      valid: false,
      diagnostics: [{
        severity: "error",
        code: cause instanceof ReadFailure ? cause.code : "READ_FAILED",
        path: currentPath,
        message: cause instanceof ReadFailure ? cause.message : "Could not read a required map document. Check its presence and read permissions; no content was changed.",
      }],
    };
  }
}
