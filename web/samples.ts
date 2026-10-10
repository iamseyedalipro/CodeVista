import { scaleSample } from "../src/scale";
import type { FlowBundle, FlowProcess, Manifest } from "../src/types";

const documents = import.meta.glob(
  "../examples/reference/{before,after}/**/*.json",
  { eager: true, import: "default" },
);
export function sample(variant = "after"): FlowBundle {
  if (variant === "scale") return scaleSample();
  const prefix = `../examples/reference/${variant === "before" ? "before" : "after"}/`;
  const manifest = documents[`${prefix}manifest.json`] as Manifest;
  return {
    manifest,
    processes: manifest.processes.map(
      (entry) => documents[`${prefix}${entry.file}`] as FlowProcess,
    ),
  };
}
