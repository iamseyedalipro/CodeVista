import type { Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { FlowBundle } from "../../src/types";
import type { Snapshot, Comparison } from "../../src/snapshot-types";

export async function reference(): Promise<FlowBundle> {
  const root = new URL("../../examples/reference/after/", import.meta.url);
  const manifest = JSON.parse(
    await readFile(new URL("manifest.json", root), "utf8"),
  );
  manifest.project.repository = {
    host: "github.com",
    owner: "private-owner",
    name: "private-project",
  };
  return {
    manifest,
    processes: await Promise.all(
      manifest.processes.map(async (entry: { file: string }) =>
        JSON.parse(await readFile(new URL(entry.file, root), "utf8")),
      ),
    ),
  };
}
export function snapshot(bundle: FlowBundle, sha = "a".repeat(40)): Snapshot {
  return {
    repository: "private-owner/private-project",
    ref: "develop",
    selectedSha: sha,
    displayedSha: sha,
    receivedAt: "2026-10-10T10:00:00Z",
    status: "valid",
    bundle,
    source: { repository: bundle.manifest.project.repository, commitSha: sha },
    freshness: { status: "not-recorded", reason: "No review receipt." },
    diagnostics: [],
    unavailable: [],
    invalidReferences: [],
    fallback: false,
  };
}
export async function mock(
  page: Page,
  supplied?: Snapshot,
  comparison?: Comparison,
) {
  const data = supplied ?? snapshot(await reference());
  let signedIn = true;
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    let body: unknown = {};
    if (path === "/api/session")
      body = {
        user: signedIn ? { login: "reviewer" } : null,
        configured: true,
        csrf: "csrf-test",
        installationUrl: "https://github.com/apps/example/installations/new",
      };
    else if (path === "/api/logout" || path === "/api/account") {
      signedIn = false;
      body = { deleted: true };
    } else if (path === "/api/repositories")
      body = {
        repositories: [
          {
            id: 10,
            fullName: data.repository,
            defaultBranch: "develop",
            selectedBranch: "develop",
            private: true,
            disconnected: false,
            lastVisitedAt: null,
          },
        ],
      };
    else if (path.endsWith("/snapshot")) body = data;
    else if (path.endsWith("/branches"))
      body = {
        branches: [
          { name: "develop", sha: data.selectedSha },
          { name: "release/v1", sha: data.selectedSha },
        ],
        hasMore: false,
      };
    else if (path.endsWith("/pulls"))
      body = {
        pulls: [{ number: 7, title: "Change payment behavior", state: "open" }],
        hasMore: false,
      };
    else if (path.includes("/comparison/")) body = comparison;
    else if (path.endsWith("/prompt"))
      body = {
        prompt: `Review private-owner/private-project on ${url.searchParams.get("ref")}. Preserve existing instructions and unaffected definitions.`,
      };
    else if (path.endsWith("/access")) body = { authorized: true };
    await route.fulfill({
      json: body,
      headers: { "cache-control": "no-store" },
    });
  });
  return data;
}
