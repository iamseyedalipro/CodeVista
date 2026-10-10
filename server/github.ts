import type { Config } from "./config.js";
import type { TreeEntry } from "../src/review.js";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
export interface Repository {
  id: number;
  full_name: string;
  name: string;
  owner: { login: string };
  default_branch: string;
  private: boolean;
  installationId?: number;
}
export interface Revision {
  sha: string;
  treeSha: string;
}
export interface PullRequest {
  number: number;
  title: string;
  state: string;
  merged: boolean;
  head: { sha: string; ref: string; repo: Repository | null };
  base: { sha: string; ref: string; repo: Repository };
}
export interface OAuthTokens {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  token_type: string;
  error?: string;
}
const API = "https://api.github.com";

export async function limitedJson(
  response: Response,
  maxBytes: number,
): Promise<unknown> {
  if (Number(response.headers.get("content-length")) > maxBytes)
    throw new ApiError(
      413,
      "RESOURCE_LIMIT",
      "The GitHub response exceeds the supported size.",
    );
  const reader = response.body?.getReader();
  if (!reader)
    throw new ApiError(
      502,
      "INVALID_PROVIDER_RESPONSE",
      "GitHub returned an empty response.",
    );
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > maxBytes)
        throw new ApiError(
          413,
          "RESOURCE_LIMIT",
          "The GitHub response exceeds the supported size.",
        );
      chunks.push(part.value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  try {
    return JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)),
    );
  } catch {
    throw new ApiError(
      502,
      "INVALID_PROVIDER_RESPONSE",
      "GitHub returned an unreadable response.",
    );
  }
}

export class GitHub {
  constructor(
    private config: Config,
    private fetcher: typeof fetch = fetch,
  ) {}
  private async fetch(url: string, options: RequestInit): Promise<Response> {
    try {
      return await this.fetcher(url, {
        ...options,
        redirect: "error",
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new ApiError(
        503,
        "GITHUB_UNAVAILABLE",
        "GitHub is temporarily unavailable. Retry without changing the selected repository or version.",
      );
    }
  }
  async request<T>(
    token: string,
    path: string,
    maxBytes = 8 * 1024 * 1024,
  ): Promise<T> {
    if (!path.startsWith("/") || path.startsWith("//"))
      throw new Error("Invalid internal API path.");
    const response = await this.fetch(`${API}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "LogicAtlas",
      },
    });
    if (!response.ok) {
      await response.body?.cancel();
      if (response.status === 401)
        throw new ApiError(
          401,
          "REAUTHENTICATE",
          "Your GitHub authorization expired or was revoked. Sign in again.",
        );
      if (
        response.status === 429 ||
        response.headers.get("x-ratelimit-remaining") === "0"
      )
        throw new ApiError(
          429,
          "RATE_LIMITED",
          "GitHub rate limit reached. Wait before retrying.",
        );
      if (response.headers.get("x-github-sso")?.startsWith("required"))
        throw new ApiError(
          403,
          "ORGANIZATION_APPROVAL",
          "Your organization requires approval or SSO authorization for this GitHub App.",
        );
      if (response.status === 403 || response.status === 404)
        throw new ApiError(
          404,
          "NOT_ACCESSIBLE",
          "This resource is unavailable or you no longer have permission to view it.",
        );
      throw new ApiError(
        503,
        "GITHUB_UNAVAILABLE",
        "GitHub could not complete the request. Retry later.",
      );
    }
    return (await limitedJson(response, maxBytes)) as T;
  }
  async exchange(fields: Record<string, string>): Promise<OAuthTokens> {
    const response = await this.fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: this.config.githubClientId,
          client_secret: this.config.githubClientSecret,
          ...fields,
        }).toString(),
      },
    );
    const data = (await limitedJson(response, 32768)) as OAuthTokens;
    if (
      !response.ok ||
      data.error ||
      typeof data.access_token !== "string" ||
      data.token_type?.toLowerCase() !== "bearer"
    )
      throw new ApiError(
        401,
        "REAUTHENTICATE",
        "GitHub authorization could not be completed. Start sign-in again.",
      );
    return data;
  }
  async repositories(token: string): Promise<Repository[]> {
    const result: Repository[] = [];
    for (let page = 1; page <= 10; page++) {
      const data = await this.request<{
        installations: {
          id: number;
          app_id: number;
          suspended_at: string | null;
        }[];
      }>(token, `/user/installations?per_page=100&page=${page}`);
      for (const installation of data.installations) {
        if (
          installation.app_id !== this.config.githubAppId ||
          installation.suspended_at
        )
          continue;
        for (let p = 1; p <= 20; p++) {
          const repos = await this.request<{ repositories: Repository[] }>(
            token,
            `/user/installations/${installation.id}/repositories?per_page=100&page=${p}`,
          );
          result.push(
            ...repos.repositories.map((repo) => ({
              ...repo,
              installationId: installation.id,
            })),
          );
          if (result.length > 2000)
            throw new ApiError(
              413,
              "REPOSITORY_LIMIT",
              "Select fewer than 2000 repositories in the GitHub App installation.",
            );
          if (repos.repositories.length < 100) break;
          if (p === 20)
            throw new ApiError(
              413,
              "REPOSITORY_LIMIT",
              "Select fewer repositories in the GitHub App installation.",
            );
        }
      }
      if (data.installations.length < 100)
        return [...new Map(result.map((repo) => [repo.id, repo])).values()];
    }
    throw new ApiError(
      413,
      "REPOSITORY_LIMIT",
      "The installation list exceeds the supported size.",
    );
  }
  async authorize(token: string, fullName: string): Promise<Repository> {
    const repo = await this.request<Repository>(
      token,
      `/repos/${repoPath(fullName)}`,
    );
    const accessible = await this.repositories(token);
    const installed = accessible.find(
      (candidate) =>
        candidate.id === repo.id &&
        candidate.full_name.toLowerCase() === repo.full_name.toLowerCase(),
    );
    if (!installed)
      throw new ApiError(
        404,
        "NOT_ACCESSIBLE",
        "This repository is unavailable or is not authorized for both you and this app.",
      );
    return { ...repo, installationId: installed.installationId! };
  }
  async resolve(
    token: string,
    fullName: string,
    ref: string,
  ): Promise<Revision> {
    if (
      typeof ref !== "string" ||
      !ref ||
      ref.length > 256 ||
      /[\u0000-\u001f\u007f]/u.test(ref)
    )
      throw new ApiError(
        400,
        "INVALID_REF",
        "Choose a valid branch or immutable commit.",
      );
    const result = await this.request<{
      sha: string;
      commit: { tree: { sha: string } };
    }>(
      token,
      `/repos/${repoPath(fullName)}/commits/${encodeURIComponent(ref)}`,
    );
    if (!validSha(result.sha) || !validSha(result.commit?.tree?.sha))
      throw new ApiError(
        502,
        "INVALID_PROVIDER_RESPONSE",
        "GitHub returned an invalid revision.",
      );
    return { sha: result.sha, treeSha: result.commit.tree.sha };
  }
  async tree(
    token: string,
    fullName: string,
    revision: Revision,
  ): Promise<{
    entries: (TreeEntry & { size?: number })[];
    truncated: boolean;
  }> {
    const result = await this.request<{
      tree: (TreeEntry & { size?: number })[];
      truncated: boolean;
    }>(
      token,
      `/repos/${repoPath(fullName)}/git/trees/${revision.treeSha}?recursive=1`,
      24 * 1024 * 1024,
    );
    return { entries: result.tree, truncated: result.truncated };
  }
  async blob(
    token: string,
    fullName: string,
    sha: string,
  ): Promise<{ value: unknown; bytes: number }> {
    if (!validSha(sha))
      throw new ApiError(400, "INVALID_BLOB", "Invalid map object.");
    const blob = await this.request<{
      encoding: string;
      content: string;
      size: number;
    }>(token, `/repos/${repoPath(fullName)}/git/blobs/${sha}`, 3 * 1024 * 1024);
    if (
      blob.encoding !== "base64" ||
      typeof blob.content !== "string" ||
      blob.size > 2 * 1024 * 1024
    )
      throw new ApiError(
        413,
        "RESOURCE_LIMIT",
        "A map document exceeds the 2 MiB limit or uses an unsupported encoding.",
      );
    const bytes = Buffer.from(blob.content, "base64");
    if (bytes.length > 2 * 1024 * 1024)
      throw new ApiError(
        413,
        "RESOURCE_LIMIT",
        "A map document exceeds the 2 MiB limit.",
      );
    try {
      return {
        value: JSON.parse(
          new TextDecoder("utf-8", { fatal: true }).decode(bytes),
        ),
        bytes: bytes.length,
      };
    } catch {
      throw new ApiError(
        422,
        "INVALID_JSON",
        "A map document is not valid UTF-8 JSON. Ask your agent to repair it.",
      );
    }
  }
  async branches(
    token: string,
    name: string,
    page = 1,
  ): Promise<{ name: string; commit: { sha: string } }[]> {
    return this.request(
      token,
      `/repos/${repoPath(name)}/branches?per_page=100&page=${page}`,
    );
  }
  async pulls(token: string, name: string, page = 1): Promise<PullRequest[]> {
    return this.request(
      token,
      `/repos/${repoPath(name)}/pulls?state=all&sort=updated&direction=desc&per_page=30&page=${page}`,
    );
  }
  async pull(
    token: string,
    name: string,
    number: number,
  ): Promise<PullRequest> {
    return this.request(token, `/repos/${repoPath(name)}/pulls/${number}`);
  }
}
export function repoPath(name: string): string {
  if (
    !/^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9_.-]{1,100}$/.test(name) ||
    [".", ".."].includes(name.split("/")[1]!)
  )
    throw new ApiError(
      400,
      "INVALID_REPOSITORY",
      "Choose a valid GitHub repository.",
    );
  return name.split("/").map(encodeURIComponent).join("/");
}
export const validSha = (value: unknown): value is string =>
  typeof value === "string" && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value);
