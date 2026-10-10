import { randomBytes } from "node:crypto";

export interface Config {
  origin: string;
  port: number;
  database: string;
  encryptionKey: Buffer;
  githubClientId: string;
  githubClientSecret: string;
  githubAppId: number;
  githubAppSlug: string;
  secureCookies: boolean;
  production: boolean;
}
export function configFromEnv(env = process.env): Config {
  const origin = new URL(env.APP_ORIGIN ?? "http://localhost:3000");
  const production = env.NODE_ENV === "production";
  if (
    !["http:", "https:"].includes(origin.protocol) ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash ||
    origin.username ||
    origin.password
  )
    throw new Error(
      "APP_ORIGIN must be an HTTP(S) origin without a path or credentials.",
    );
  if (production && origin.protocol !== "https:")
    throw new Error(
      "Production APP_ORIGIN must use HTTPS behind a trusted reverse proxy.",
    );
  const configured = [
    env.GITHUB_CLIENT_ID,
    env.GITHUB_CLIENT_SECRET,
    env.GITHUB_APP_ID,
    env.GITHUB_APP_SLUG,
  ].some(Boolean);
  if (
    configured &&
    (!env.GITHUB_CLIENT_ID ||
      !env.GITHUB_CLIENT_SECRET ||
      !env.GITHUB_APP_ID ||
      !env.GITHUB_APP_SLUG)
  )
    throw new Error("Configure all GitHub App settings together.");
  if ((production || configured) && !env.SESSION_ENCRYPTION_KEY)
    throw new Error("Set a persistent 32-byte base64 SESSION_ENCRYPTION_KEY.");
  const encryptionKey = env.SESSION_ENCRYPTION_KEY
    ? Buffer.from(env.SESSION_ENCRYPTION_KEY, "base64")
    : randomBytes(32);
  if (encryptionKey.length !== 32)
    throw new Error("SESSION_ENCRYPTION_KEY must decode to exactly 32 bytes.");
  const port = Number(env.PORT ?? 3000);
  const githubAppId = Number(env.GITHUB_APP_ID ?? 0);
  if (
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    !Number.isSafeInteger(githubAppId) ||
    (configured && githubAppId <= 0)
  )
    throw new Error("Invalid port or GitHub App ID.");
  const githubAppSlug = env.GITHUB_APP_SLUG ?? "";
  if (githubAppSlug && !/^[a-z0-9-]+$/.test(githubAppSlug))
    throw new Error("Invalid GitHub App slug.");
  return {
    origin: origin.origin,
    port,
    database: env.DATABASE_PATH ?? "data/logicatlas.sqlite",
    encryptionKey,
    githubClientId: env.GITHUB_CLIENT_ID ?? "",
    githubClientSecret: env.GITHUB_CLIENT_SECRET ?? "",
    githubAppId,
    githubAppSlug,
    secureCookies: origin.protocol === "https:",
    production,
  };
}
