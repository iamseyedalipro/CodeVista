import { loadFlowDirectory } from "./load.js";

const args = process.argv.slice(2);
if (args.includes("--help")) {
  console.log("Usage: npm run validate -- [map-directory] [--json]\nDefault directory: .logicatlas\nChecks structure only; does not establish freshness, authorization, or behavioral accuracy.");
} else if (args.filter(arg => arg === "--json").length > 1 || args.some(arg => arg.startsWith("-") && arg !== "--json") || args.filter(arg => arg !== "--json").length > 1) {
  console.error("Usage: npm run validate -- [map-directory] [--json]");
  process.exitCode = 2;
} else {
  const directory = args.find(arg => arg !== "--json") ?? ".logicatlas";
  const result = await loadFlowDirectory(directory);
  const summary = {
    valid: result.valid,
    assurance: "structure-only",
    processCount: result.valid ? result.bundle.processes.length : null,
    diagnostics: result.diagnostics,
  };
  if (args.includes("--json")) console.log(JSON.stringify(summary, null, 2));
  else {
    console.log(result.valid ? "Map structure is valid. Behavioral accuracy, source existence, and freshness have not been verified." : "Map validation failed. No files were changed.");
    for (const item of result.diagnostics) console.log(`${item.severity.toUpperCase()} ${item.code} ${item.path}: ${item.message}`);
  }
  if (!result.valid) process.exitCode = 1;
}
