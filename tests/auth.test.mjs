import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../dist/server/app.js";
import { configFromEnv } from "../dist/server/config.js";
import { Store, secret } from "../dist/server/store.js";
import { GitHub, ApiError, limitedJson } from "../dist/server/github.js";

export const testConfig = () => ({
  ...configFromEnv({ DATABASE_PATH: ":memory:" }),
  githubAppId: 7,
  githubClientId: "client",
  githubClientSecret: "test-secret",
  githubAppSlug: "test-app",
});
export const sessionValue = (userId = 1) => ({
  userId,
  login: `person${userId}`,
  accessToken: `private-token-${userId}`,
  tokenExpiresAt: Date.now() + 3600000,
  csrf: secret(),
  disconnected: [],
  preferences: {},
});
const repository = {
  id: 10,
  full_name: "sample/project",
  name: "project",
  owner: { login: "sample" },
  default_branch: "develop",
  private: true,
};
export async function harness(t, overrides = {}) {
  const config = testConfig();
  const store = new Store(":memory:", config.encryptionKey);
  const github = {
    request: async () => ({ id: 1, login: "person1" }),
    authorize: async () => repository,
    repositories: async () => [repository],
    resolve: async () => ({ sha: "a".repeat(40), treeSha: "b".repeat(40) }),
    exchange: async () => ({
      access_token: "new-token",
      token_type: "bearer",
      expires_in: 28800,
    }),
    ...overrides,
  };
  const service = await createApp(config, { store, github });
  t.after(() => service.app.close());
  const value = sessionValue();
  const id = store.create(value);
  const headers = {
    cookie: `codevista=${id}`,
    origin: config.origin,
    "x-csrf-token": value.csrf,
  };
  return { ...service, id, headers, value };
}
test("sessions encrypt credentials on disk and account preferences survive new sessions", async () => {
  const directory = await mkdtemp(join(tmpdir(), "codevista-store-"));
  try {
    const path = join(directory, "sessions.sqlite");
    const store = new Store(path, Buffer.alloc(32, 2));
    const value = sessionValue();
    const id = store.create(value);
    value.disconnected = [10];
    value.preferences["10"] = {
      branch: "develop",
      lastVisitedAt: "2026-01-01",
      fullName: "sample/project",
    };
    store.saveAccount(value);
    const second = store.create(sessionValue());
    assert.deepEqual(store.get(second).disconnected, [10]);
    assert.equal(store.get(id).preferences["10"].branch, "develop");
    store.close();
    const raw = (await readFile(path)).toString();
    assert.ok(!raw.includes(value.accessToken));
    assert.ok(!raw.includes("sample/project"));
    assert.ok(!raw.includes(id));
    const again = new Store(path, Buffer.alloc(32, 2));
    assert.equal(again.get(id).userId, 1);
    again.deleteUser(1);
    assert.equal(again.get(second), null);
    again.close();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
test("OAuth state is single-use and bound to its browser nonce", () => {
  const store = new Store(":memory:", Buffer.alloc(32));
  store.beginOAuth("state", "nonce", "verifier");
  assert.equal(store.consumeOAuth("state", "wrong"), null);
  assert.equal(store.consumeOAuth("state", "nonce"), null);
  store.beginOAuth("state2", "nonce", "verifier");
  assert.equal(store.consumeOAuth("state2", "nonce"), "verifier");
  assert.equal(store.consumeOAuth("state2", "nonce"), null);
  store.close();
});
test("OAuth uses PKCE and exchanges only a browser-bound callback", async (t) => {
  let exchanges = 0;
  const h = await harness(t, {
    exchange: async (fields) => {
      exchanges++;
      assert.ok(fields.code_verifier);
      return { access_token: "token", token_type: "bearer" };
    },
  });
  const start = await h.app.inject({ url: "/auth/github" });
  const url = new URL(start.headers.location);
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  const cookie = start.cookies[0];
  assert.ok(cookie.httpOnly);
  assert.equal(cookie.sameSite, "Lax");
  const wrong = await h.app.inject({
    url: `/auth/callback?state=${url.searchParams.get("state")}&code=abc`,
  });
  assert.match(wrong.headers.location, /failed/);
  assert.equal(exchanges, 0);
  const finish = await h.app.inject({
    url: `/auth/callback?state=${url.searchParams.get("state")}&code=abc`,
    cookies: { [cookie.name]: cookie.value },
  });
  assert.equal(finish.headers.location, "/#/projects");
  assert.equal(exchanges, 1);
  assert.ok(!finish.body.includes("token"));
});
test("unsafe origins, absent CSRF, and multibyte CSRF values fail closed", async (t) => {
  const h = await harness(t);
  for (const headers of [
    { ...h.headers, origin: "https://evil.test" },
    { cookie: h.headers.cookie, origin: h.config.origin },
    { ...h.headers, "x-csrf-token": "é".repeat(43) },
  ]) {
    const result = await h.app.inject({
      method: "POST",
      url: "/api/logout",
      headers,
    });
    assert.equal(result.statusCode, 403);
  }
  assert.ok(h.store.get(h.id));
});
test("logout deletes the session; a copied private link requires authentication", async (t) => {
  const h = await harness(t);
  const result = await h.app.inject({
    method: "POST",
    url: "/api/logout",
    headers: h.headers,
  });
  assert.equal(result.statusCode, 200);
  assert.equal(h.store.get(h.id), null);
  assert.equal(
    (
      await h.app.inject({
        url: "/api/repositories/sample/project/branches",
        headers: h.headers,
      })
    ).statusCode,
    401,
  );
});
test("revocation invalidates sessions and private responses cannot be cached", async (t) => {
  const h = await harness(t, {
    authorize: async () => {
      throw new ApiError(401, "REAUTHENTICATE", "Sign in again.");
    },
  });
  const result = await h.app.inject({
    url: "/api/repositories/sample/project/branches",
    headers: h.headers,
  });
  assert.equal(result.statusCode, 401);
  assert.match(result.headers["cache-control"], /no-store/);
  assert.equal(h.store.get(h.id), null);
  assert.ok(!result.body.includes(h.value.accessToken));
});
test("repository listings respect actual default and saved branches without exposing tokens", async (t) => {
  const h = await harness(t);
  await h.app.inject({
    method: "POST",
    url: "/api/repositories/sample/project/preference",
    payload: { branch: "release/v1" },
    headers: h.headers,
  });
  const result = await h.app.inject({
    url: "/api/repositories",
    headers: h.headers,
  });
  assert.equal(result.json().repositories[0].selectedBranch, "release/v1");
  assert.ok(!result.body.includes("private-token"));
});
test("disconnect applies across sessions and remains possible after access is revoked", async (t) => {
  const h = await harness(t);
  await h.app.inject({
    method: "POST",
    url: "/api/repositories/sample/project/preference",
    payload: { branch: "develop" },
    headers: h.headers,
  });
  const second = h.store.create(sessionValue());
  h.github.authorize = async () => {
    throw new ApiError(404, "NOT_ACCESSIBLE", "Unavailable.");
  };
  const result = await h.app.inject({
    method: "POST",
    url: "/api/repositories/sample/project/disconnect",
    headers: h.headers,
  });
  assert.equal(result.statusCode, 200);
  assert.deepEqual(h.store.get(second).disconnected, [10]);
  assert.equal(result.json().repositoryFilesChanged, false);
});
test("account deletion removes every session without affecting another user", async (t) => {
  const h = await harness(t);
  const second = h.store.create(sessionValue());
  const other = h.store.create(sessionValue(2));
  assert.equal(
    (
      await h.app.inject({
        method: "DELETE",
        url: "/api/account",
        headers: h.headers,
      })
    ).statusCode,
    200,
  );
  assert.equal(h.store.get(second), null);
  assert.ok(h.store.get(other));
});
test("GitHub authorization requires both user access and an active installation of this app", async () => {
  const config = testConfig();
  let suspended = false;
  let ownApp = true;
  let granted = true;
  const github = new GitHub(config, async (url, init) => {
    assert.equal(init.headers.Authorization, "Bearer user-token");
    assert.equal(init.redirect, "error");
    if (url.includes("/user/installations?"))
      return Response.json({
        installations: [
          {
            id: 5,
            app_id: ownApp ? 7 : 8,
            suspended_at: suspended ? "2026-01-01" : null,
          },
        ],
      });
    if (url.includes("/user/installations/5/"))
      return Response.json({ repositories: granted ? [repository] : [] });
    if (url.endsWith("/repos/sample/project")) return Response.json(repository);
    throw new Error("Unexpected request");
  });
  assert.equal((await github.authorize("user-token", "sample/project")).id, 10);
  for (const change of [
    () => {
      suspended = true;
    },
    () => {
      suspended = false;
      ownApp = false;
    },
    () => {
      ownApp = true;
      granted = false;
    },
  ]) {
    change();
    await assert.rejects(
      github.authorize("user-token", "sample/project"),
      (error) => error.status === 404,
    );
  }
});
test("GitHub errors distinguish SSO, rate limits, outages, and revoked credentials without provider bodies", async () => {
  for (const [status, headers, expected] of [
    [401, {}, "REAUTHENTICATE"],
    [403, { "x-github-sso": "required; url=private" }, "ORGANIZATION_APPROVAL"],
    [403, { "x-ratelimit-remaining": "0" }, "RATE_LIMITED"],
    [500, {}, "GITHUB_UNAVAILABLE"],
  ]) {
    const github = new GitHub(
      testConfig(),
      async () => new Response("PRIVATE PROVIDER DETAILS", { status, headers }),
    );
    await assert.rejects(
      github.request("token", "/user"),
      (error) => error.code === expected && !error.message.includes("PRIVATE"),
    );
  }
});
test("provider size budgets and production configuration fail closed", async () => {
  assert.throws(() => configFromEnv({ GITHUB_APP_SLUG: "partial-app" }));
  await assert.rejects(
    limitedJson(new Response("1234567890"), 3),
    (error) => error.code === "RESOURCE_LIMIT",
  );
  assert.throws(() =>
    configFromEnv({
      NODE_ENV: "production",
      APP_ORIGIN: "http://example.test",
    }),
  );
  assert.throws(() =>
    configFromEnv({
      NODE_ENV: "production",
      APP_ORIGIN: "https://example.test",
    }),
  );
});

test("concurrent expired-token requests share one refresh and preserve account settings", async (t) => {
  let exchanges = 0;
  let release;
  const h = await harness(t, {
    exchange: async () => {
      exchanges++;
      await new Promise((resolve) => {
        release = resolve;
      });
      return {
        access_token: "refreshed",
        token_type: "bearer",
        expires_in: 3600,
        refresh_token: "rotated",
        refresh_token_expires_in: 36000,
      };
    },
  });
  h.store.save(h.id, {
    ...h.value,
    tokenExpiresAt: Date.now() - 1,
    refreshToken: "old-refresh",
    refreshExpiresAt: Date.now() + 360000,
  });
  const first = h.sessionFor({ codevista: h.id });
  const second = h.sessionFor({ codevista: h.id });
  const account = h.store.get(h.id);
  account.disconnected = [10];
  h.store.saveAccount(account);
  release();
  const results = await Promise.all([first, second]);
  assert.equal(exchanges, 1);
  assert.ok(
    results.every((result) => result.session.accessToken === "refreshed"),
  );
  assert.deepEqual(h.store.get(h.id).disconnected, [10]);
});
test("encrypted sessions cannot be read using a different host key", async () => {
  const directory = await mkdtemp(join(tmpdir(), "codevista-key-"));
  try {
    const path = join(directory, "sessions.sqlite");
    const first = new Store(path, Buffer.alloc(32, 1));
    const id = first.create(sessionValue());
    first.close();
    const second = new Store(path, Buffer.alloc(32, 2));
    assert.equal(second.get(id), null);
    second.close();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
test("static routes do not serve repository source, database, or encoded traversal paths", async (t) => {
  const h = await harness(t);
  for (const url of [
    "/server/app.ts",
    "/data/codevista.sqlite",
    "/%2e%2e/server/app.ts",
    "/..%2f.env",
    "/%2fapi/repositories",
  ]) {
    const response = await h.app.inject({ url });
    assert.ok(
      [400, 404].includes(response.statusCode),
      `${url}: ${response.statusCode}`,
    );
    assert.ok(!response.body.includes("githubClientSecret"));
  }
});

test("expired preferences do not silently reconnect a disconnected project", (t) => {
  const store = new Store(":memory:", Buffer.alloc(32));
  t.after(() => store.close());
  const value = sessionValue();
  value.disconnected = [10];
  value.preferences["10"] = {
    branch: "develop",
    fullName: "sample/project",
    lastVisitedAt: "2026-01-01",
  };
  store.create(value);
  const future = Date.now() + 31 * 24 * 60 * 60 * 1000;
  t.mock.method(Date, "now", () => future);
  store.prune();
  const renewed = store.create(sessionValue());
  assert.deepEqual(store.get(renewed).disconnected, [10]);
  assert.deepEqual(store.get(renewed).preferences, {});
  store.deleteUser(value.userId);
  const reset = store.create(sessionValue());
  assert.deepEqual(store.get(reset).disconnected, []);
});
