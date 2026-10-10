import { build } from "esbuild";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { zipSync, strToU8 } from "fflate";
import { MAINTENANCE_RULES } from "../dist/src/agent.js";

await mkdir("public/agent", { recursive: true });
const files = {};
for (const [name, entry] of [
  ["validate", "src/cli.ts"],
  ["review", "src/review-cli.ts"],
]) {
  const output = await build({
    entryPoints: [entry],
    bundle: true,
    platform: "node",
    target: "node22",
    format: "esm",
    write: false,
    banner: {
      js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
    },
  });
  files[`tools/${name}.mjs`] = output.outputFiles[0].contents;
}
files["LICENSE"] = new Uint8Array(await readFile("LICENSE"));
files["FORMAT.md"] = new Uint8Array(await readFile("docs/flow-format.md"));
files["MAINTENANCE.md"] = strToU8(MAINTENANCE_RULES + "\n");
for (const name of ["common", "manifest", "process"])
  files[`schemas/${name}.schema.json`] = new Uint8Array(
    await readFile(`schemas/${name}.schema.json`),
  );
files["THIRD-PARTY-NOTICES.txt"] = strToU8(
  "The bundled validator includes Ajv and dependencies under their respective licenses.\n\n" +
    (await readFile("node_modules/ajv/LICENSE", "utf8")) +
    "\n\n" +
    (await readFile("node_modules/fast-uri/LICENSE", "utf8")) +
    "\n\n" +
    (await readFile("node_modules/fast-deep-equal/LICENSE", "utf8")) +
    "\n\n" +
    (await readFile("node_modules/json-schema-traverse/LICENSE", "utf8")) +
    "\n\n" +
    (await readFile("node_modules/require-from-string/license", "utf8")),
);
await writeFile(
  "public/agent/logicatlas-kit.zip",
  zipSync(files, { level: 6 }),
);
console.log(
  "Built the standalone agent kit; no AI API or hosted runtime dependency is included.",
);
