import { readFile } from "node:fs/promises";

export async function fixture(variant = "after") {
  const directory = new URL(`../examples/reference/${variant}/`, import.meta.url);
  const manifest = JSON.parse(await readFile(new URL("manifest.json", directory), "utf8"));
  const processes = await Promise.all(manifest.processes.map(async entry =>
    JSON.parse(await readFile(new URL(entry.file, directory), "utf8"))));
  return { manifest, processes };
}

export const processById = (bundle, id) => bundle.processes.find(process => process.id === id);
export const nodeById = (bundle, processId, nodeId) => processById(bundle, processId).nodes.find(node => node.id === nodeId);
