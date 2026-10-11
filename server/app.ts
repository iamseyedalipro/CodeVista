import Fastify from "fastify";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import staticFiles from "@fastify/static";
import { createHash, timingSafeEqual } from "node:crypto";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import type { Config } from "./config.js";
import { Store, SESSION_TTL, secret, type Session } from "./store.js";
import {
  ApiError,
  GitHub,
  type OAuthTokens,
  type Repository,
} from "./github.js";
import { setupPrompt, recoveryPrompt } from "../src/agent.js";

export interface AuthContext {
  id: string;
  session: Session;
  repository: Repository;
}
export async function createApp(
  config: Config,
  dependencies: { github?: GitHub; store?: Store } = {},
) {
  const app = Fastify({
    logger: false,
    bodyLimit: 16384,
    requestTimeout: 20000,
    connectionTimeout: 20000,
    trustProxy: false,
  });
  const github = dependencies.github ?? new GitHub(config);
  const store =
    dependencies.store ?? new Store(config.database, config.encryptionKey);
  const cookieName = config.secureCookies ? "__Host-codevista" : "codevista";
  const oauthCookie = config.secureCookies
    ? "__Host-codevista-oauth"
    : "codevista-oauth";
  const cookieOptions = {
    httpOnly: true,
    secure: config.secureCookies,
    sameSite: "lax" as const,
    path: "/",
  };
  const refreshes = new Map<string, Promise<void>>();
  const limits = new Map<string, { count: number; until: number }>();
  const clearPrivate = new Set<(sessionId: string) => void>();
  await app.register(cookie);
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: config.secureCookies ? [] : null,
      },
    },
    referrerPolicy: { policy: "no-referrer" },
    crossOriginEmbedderPolicy: false,
    hsts: config.secureCookies,
  });
  const pruneTimer = setInterval(() => {
    store.prune();
    for (const [key, value] of limits)
      if (value.until < Date.now()) limits.delete(key);
  }, 60000);
  pruneTimer.unref();
  app.addHook("onClose", async () => {
    clearInterval(pruneTimer);
    store.close();
  });
  app.addHook("onRequest", async (request, reply) => {
    if (!request.url.startsWith("/api/") && !request.url.startsWith("/auth/"))
      return;
    reply
      .header("Cache-Control", "no-store, private")
      .header("Pragma", "no-cache")
      .header("Vary", "Cookie");
    const key = `${request.ip}:${request.url.startsWith("/auth/") ? "auth" : "api"}`;
    let rate = limits.get(key);
    if (!rate || rate.until < Date.now()) {
      if (limits.size > 10000)
        throw new ApiError(
          503,
          "CAPACITY",
          "The service is busy. Retry later.",
        );
      rate = { count: 0, until: Date.now() + 60000 };
      limits.set(key, rate);
    }
    if (++rate.count > (request.url.startsWith("/auth/") ? 30 : 300)) {
      reply.header("Retry-After", "60");
      throw new ApiError(
        429,
        "RATE_LIMITED",
        "Too many requests. Retry in one minute.",
      );
    }
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      if (
        request.headers.origin !== config.origin ||
        request.headers["sec-fetch-site"] === "cross-site"
      )
        throw new ApiError(
          403,
          "CSRF",
          "The request origin is not authorized.",
        );
      const id = request.cookies[cookieName];
      const session = id ? store.get(id) : null;
      if (!session)
        throw new ApiError(
          401,
          "SIGN_IN_REQUIRED",
          "Sign in with GitHub to continue.",
        );
      const csrf = request.headers["x-csrf-token"];
      if (
        typeof csrf !== "string" ||
        Buffer.byteLength(csrf) !== Buffer.byteLength(session.csrf) ||
        !timingSafeEqual(Buffer.from(csrf), Buffer.from(session.csrf))
      )
        throw new ApiError(
          403,
          "CSRF",
          "Refresh the page before retrying this action.",
        );
    }
  });
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) {
      if (error.status === 401) {
        const id = request.cookies[cookieName];
        if (id) {
          store.delete(id);
          for (const clear of clearPrivate) clear(id);
        }
        reply.clearCookie(cookieName, cookieOptions);
      }
      return reply
        .code(error.status)
        .send({ error: { code: error.code, message: error.message } });
    }
    if (
      error &&
      typeof error === "object" &&
      "statusCode" in error &&
      [400, 413, 415].includes(Number(error.statusCode))
    )
      return reply.code(Number(error.statusCode)).send({
        error: {
          code: "INVALID_REQUEST",
          message:
            "The request is malformed, too large, or uses an unsupported content type.",
        },
      });
    return reply.code(500).send({
      error: {
        code: "INTERNAL_ERROR",
        message:
          "The request could not be completed. No repository content was changed.",
      },
    });
  });

  async function sessionFor(
    cookies: Record<string, string | undefined>,
  ): Promise<{ id: string; session: Session }> {
    const id = cookies[cookieName];
    let session = id ? store.get(id) : null;
    if (!id || !session)
      throw new ApiError(
        401,
        "SIGN_IN_REQUIRED",
        "Sign in with GitHub to continue.",
      );
    if (session.tokenExpiresAt <= Date.now() + 60000) {
      if (!refreshes.has(id)) {
        const pending = (async () => {
          const current = store.get(id);
          if (
            !current?.refreshToken ||
            (current.refreshExpiresAt ?? 0) <= Date.now()
          )
            throw new ApiError(
              401,
              "REAUTHENTICATE",
              "Your GitHub session expired. Sign in again.",
            );
          const tokens = await github.exchange({
            grant_type: "refresh_token",
            refresh_token: current.refreshToken,
          });
          const latest = store.get(id);
          if (!latest)
            throw new ApiError(
              401,
              "SIGN_IN_REQUIRED",
              "Sign in with GitHub to continue.",
            );
          store.save(id, { ...latest, ...tokenFields(tokens) });
        })();
        refreshes.set(id, pending);
      }
      try {
        await refreshes.get(id);
      } finally {
        refreshes.delete(id);
      }
      session = store.get(id);
      if (!session)
        throw new ApiError(
          401,
          "SIGN_IN_REQUIRED",
          "Sign in with GitHub to continue.",
        );
    }
    return { id, session };
  }
  async function authorize(
    cookies: Record<string, string | undefined>,
    name: string,
    allowDisconnected = false,
  ): Promise<AuthContext> {
    const auth = await sessionFor(cookies);
    const repository = await github.authorize(auth.session.accessToken, name);
    if (!allowDisconnected && auth.session.disconnected.includes(repository.id))
      throw new ApiError(
        404,
        "DISCONNECTED",
        "This project is disconnected. Reconnect it from Projects before viewing it.",
      );
    return { ...auth, repository };
  }

  app.get<{ Params: { owner: string; repo: string } }>(
    "/api/repositories/:owner/:repo/access",
    async (request) => {
      await authorize(
        request.cookies,
        `${request.params.owner}/${request.params.repo}`,
      );
      return { authorized: true };
    },
  );
  app.get("/healthz", async () => ({ status: "ok" }));
  app.get("/api/session", async (request) => {
    if (
      !request.cookies[cookieName] ||
      !store.get(request.cookies[cookieName]!)
    )
      return {
        user: null,
        configured: !!config.githubClientId,
        installationUrl: config.githubAppSlug
          ? `https://github.com/apps/${config.githubAppSlug}/installations/new`
          : null,
      };
    const { session } = await sessionFor(request.cookies);
    const user = await github.request<{ id: number; login: string }>(
      session.accessToken,
      "/user",
    );
    if (user.id !== session.userId)
      throw new ApiError(
        401,
        "REAUTHENTICATE",
        "Your GitHub session changed. Sign in again.",
      );
    return {
      user: { login: user.login },
      csrf: session.csrf,
      configured: true,
      installationUrl: `https://github.com/apps/${config.githubAppSlug}/installations/new`,
    };
  });
  app.get("/auth/github", async (_, reply) => {
    if (!config.githubClientId)
      throw new ApiError(
        503,
        "NOT_CONFIGURED",
        "This host has not configured a GitHub App. Configure the host to enable GitHub connections.",
      );
    const state = secret();
    const nonce = secret();
    const verifier = secret();
    store.beginOAuth(state, nonce, verifier);
    reply.setCookie(oauthCookie, nonce, { ...cookieOptions, maxAge: 600 });
    const params = new URLSearchParams({
      client_id: config.githubClientId,
      redirect_uri: `${config.origin}/auth/callback`,
      state,
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      code_challenge_method: "S256",
    });
    return reply.redirect(`https://github.com/login/oauth/authorize?${params}`);
  });
  app.get<{ Querystring: { state?: string; code?: string; error?: string } }>(
    "/auth/callback",
    async (request, reply) => {
      const { state, code, error } = request.query;
      reply.clearCookie(oauthCookie, cookieOptions);
      if (error || !state || state.length > 128 || !code || code.length > 512)
        return reply.redirect("/#/projects?auth=failed");
      const nonce = request.cookies[oauthCookie];
      const verifier = nonce ? store.consumeOAuth(state, nonce) : null;
      if (!verifier) return reply.redirect("/#/projects?auth=failed");
      const tokens = await github.exchange({
        code,
        code_verifier: verifier,
        redirect_uri: `${config.origin}/auth/callback`,
      });
      const user = await github.request<{ id: number; login: string }>(
        tokens.access_token,
        "/user",
      );
      if (!Number.isSafeInteger(user.id) || typeof user.login !== "string")
        throw new ApiError(
          502,
          "INVALID_PROVIDER_RESPONSE",
          "GitHub returned an invalid account.",
        );
      const old = request.cookies[cookieName];
      if (old) {
        store.delete(old);
        for (const clear of clearPrivate) clear(old);
      }
      const id = store.create({
        userId: user.id,
        login: user.login,
        ...tokenFields(tokens),
        csrf: secret(),
        disconnected: [],
        preferences: {},
      });
      reply.setCookie(cookieName, id, {
        ...cookieOptions,
        maxAge: SESSION_TTL / 1000,
      });
      return reply.redirect("/#/projects");
    },
  );
  app.post("/api/logout", async (request, reply) => {
    const id = request.cookies[cookieName]!;
    store.delete(id);
    for (const clear of clearPrivate) clear(id);
    reply
      .clearCookie(cookieName, cookieOptions)
      .header("Clear-Site-Data", '"cache", "storage"');
    return { disconnected: true };
  });
  app.delete("/api/account", async (request, reply) => {
    const { session } = await sessionFor(request.cookies);
    store.deleteUser(session.userId);
    for (const clear of clearPrivate) clear("*");
    reply
      .clearCookie(cookieName, cookieOptions)
      .header("Clear-Site-Data", '"cache", "storage"');
    return { deleted: true, repositoryFilesChanged: false };
  });
  app.get("/api/repositories", async (request) => {
    const { session } = await sessionFor(request.cookies);
    const repositories = await github.repositories(session.accessToken);
    return {
      repositories: repositories.map((repo) => ({
        id: repo.id,
        fullName: repo.full_name,
        private: repo.private,
        defaultBranch: repo.default_branch,
        selectedBranch:
          session.preferences[String(repo.id)]?.branch ?? repo.default_branch,
        lastVisitedAt:
          session.preferences[String(repo.id)]?.lastVisitedAt ?? null,
        disconnected: session.disconnected.includes(repo.id),
      })),
    };
  });
  app.get<{
    Params: { owner: string; repo: string };
    Querystring: { page?: string };
  }>("/api/repositories/:owner/:repo/branches", async (request) => {
    const auth = await authorize(
      request.cookies,
      `${request.params.owner}/${request.params.repo}`,
    );
    const page = pageNumber(request.query.page);
    const branches = await github.branches(
      auth.session.accessToken,
      auth.repository.full_name,
      page,
    );
    return {
      branches: branches.map((branch) => ({
        name: branch.name,
        sha: branch.commit.sha,
      })),
      hasMore: branches.length === 100,
      page,
    };
  });
  app.get<{
    Params: { owner: string; repo: string };
    Querystring: { page?: string };
  }>("/api/repositories/:owner/:repo/pulls", async (request) => {
    const auth = await authorize(
      request.cookies,
      `${request.params.owner}/${request.params.repo}`,
    );
    const page = pageNumber(request.query.page);
    const pulls = await github.pulls(
      auth.session.accessToken,
      auth.repository.full_name,
      page,
    );
    return {
      pulls: pulls.map((pr) => ({
        number: pr.number,
        title: pr.title,
        state: pr.state,
      })),
      hasMore: pulls.length === 30,
      page,
    };
  });
  app.post<{
    Params: { owner: string; repo: string };
    Body: { branch?: string };
  }>("/api/repositories/:owner/:repo/preference", async (request) => {
    const auth = await authorize(
      request.cookies,
      `${request.params.owner}/${request.params.repo}`,
    );
    const branch = request.body?.branch;
    if (typeof branch !== "string")
      throw new ApiError(400, "INVALID_REF", "Select a branch.");
    await github.resolve(
      auth.session.accessToken,
      auth.repository.full_name,
      branch,
    );
    const latest = store.get(auth.id)!;
    latest.preferences[String(auth.repository.id)] = {
      branch,
      lastVisitedAt: new Date().toISOString(),
      fullName: auth.repository.full_name,
    };
    store.saveAccount(latest);
    return { saved: true };
  });
  for (const action of ["disconnect", "reconnect"] as const) {
    app.post<{ Params: { owner: string; repo: string } }>(
      `/api/repositories/:owner/:repo/${action}`,
      async (request) => {
        const name = `${request.params.owner}/${request.params.repo}`;
        const signedIn = await sessionFor(request.cookies);
        const known = Object.entries(signedIn.session.preferences).find(
          ([, value]) => value.fullName?.toLowerCase() === name.toLowerCase(),
        );
        const auth =
          action === "disconnect" && known
            ? { ...signedIn, repository: { id: Number(known[0]) } }
            : await authorize(request.cookies, name, true);
        const latest = store.get(auth.id)!;
        latest.disconnected = [
          ...new Set([
            ...latest.disconnected.filter((id) => id !== auth.repository.id),
            ...(action === "disconnect" ? [auth.repository.id] : []),
          ]),
        ];
        if (action === "disconnect")
          delete latest.preferences[String(auth.repository.id)];
        store.saveAccount(latest);
        for (const clear of clearPrivate) clear("*");
        return {
          disconnected: action === "disconnect",
          repositoryFilesChanged: false,
        };
      },
    );
  }
  app.get<{
    Params: { owner: string; repo: string };
    Querystring: { ref?: string; language?: string; mode?: string };
  }>("/api/repositories/:owner/:repo/prompt", async (request) => {
    const auth = await authorize(
      request.cookies,
      `${request.params.owner}/${request.params.repo}`,
    );
    const ref = request.query.ref ?? auth.repository.default_branch;
    await github.resolve(
      auth.session.accessToken,
      auth.repository.full_name,
      ref,
    );
    const language = request.query.language === "fa" ? "Persian" : "English";
    const context = {
      repository: auth.repository.full_name,
      branch: ref,
      language,
      kitUrl: `${config.origin}/agent/codevista-kit.zip`,
    };
    return {
      prompt:
        request.query.mode === "recovery"
          ? recoveryPrompt(context)
          : setupPrompt(context),
    };
  });

  if (existsSync(resolve("web-dist")))
    await app.register(staticFiles, {
      root: resolve("web-dist"),
      setHeaders: (res) => {
        res.header("Cache-Control", "no-store");
      },
    });
  return { app, github, store, authorize, sessionFor, clearPrivate, config };
}
function tokenFields(
  tokens: OAuthTokens,
): Pick<
  Session,
  "accessToken" | "tokenExpiresAt" | "refreshToken" | "refreshExpiresAt"
> {
  if (
    tokens.expires_in !== undefined &&
    (!Number.isFinite(tokens.expires_in) || tokens.expires_in <= 0)
  )
    throw new ApiError(
      502,
      "INVALID_PROVIDER_RESPONSE",
      "GitHub returned an invalid token lifetime.",
    );
  return {
    accessToken: tokens.access_token,
    tokenExpiresAt: tokens.expires_in
      ? Date.now() + tokens.expires_in * 1000
      : Date.now() + SESSION_TTL,
    ...(tokens.refresh_token
      ? {
          refreshToken: tokens.refresh_token,
          refreshExpiresAt:
            Date.now() + (tokens.refresh_token_expires_in ?? 0) * 1000,
        }
      : {}),
  };
}
function pageNumber(value?: string): number {
  const page = Number(value ?? 1);
  if (!Number.isInteger(page) || page < 1 || page > 1000)
    throw new ApiError(400, "INVALID_PAGE", "Choose a valid page number.");
  return page;
}
