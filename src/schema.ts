import { Ajv2020 } from "ajv/dist/2020.js";
import type { ErrorObject, ValidateFunction } from "ajv";
import commonSchema from "../schemas/common.schema.json" with { type: "json" };
import manifestSchema from "../schemas/manifest.schema.json" with { type: "json" };
import processSchema from "../schemas/process.schema.json" with { type: "json" };
import type { Diagnostic, FlowProcess, Manifest, ValidationResult } from "./types.js";

export const SCHEMA_VERSION = "1.0.0" as const;

// Only bundled, trusted schemas are compiled. Repository documents cannot supply schemas.
const ajv = new Ajv2020({ allErrors: true, strict: true, ownProperties: true });
ajv.addSchema(commonSchema);
const manifestValidator = ajv.compile<Manifest>(manifestSchema);
const processValidator = ajv.compile<FlowProcess>(processSchema);

function schemaDiagnostic(error: ErrorObject, path: string): Diagnostic {
  return {
    severity: "error",
    code: "INVALID_STRUCTURE",
    path: `${path}${error.instancePath}`,
    // Do not echo document values or arbitrary property names into logs or HTML.
    message: `The document violates the ${error.keyword} rule. Compare this location with the versioned schema.`,
  };
}

function validateDocument<T>(value: unknown, validator: ValidateFunction<T>, path: string): ValidationResult {
  if (typeof value === "object" && value !== null && "schemaVersion" in value && value.schemaVersion !== SCHEMA_VERSION) {
    return {
      valid: false,
      diagnostics: [{
        severity: "error", code: "UNSUPPORTED_VERSION", path: `${path}/schemaVersion`,
        message: "Unsupported map format. Use a compatible reader or explicitly migrate a copy to 1.0.0; never relabel the version without migration.",
      }],
    };
  }
  const valid = validator(value);
  return { valid, diagnostics: (validator.errors ?? []).slice(0, 100).map(error => schemaDiagnostic(error, path)) };
}

export function validateManifest(value: unknown): ValidationResult {
  return validateDocument(value, manifestValidator, "/manifest");
}

export function validateProcess(value: unknown, path = "/process"): ValidationResult {
  return validateDocument(value, processValidator, path);
}
