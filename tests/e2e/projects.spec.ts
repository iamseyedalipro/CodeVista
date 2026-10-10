import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { FlowBundle } from "../../src/types";
import type { Snapshot, Comparison } from "../../src/snapshot-types";

async function reference(): Promise<FlowBundle> {
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
function snapshot(bundle: FlowBundle, sha = "a".repeat(40)): Snapshot {
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
async function mock(page: Page, supplied?: Snapshot, comparison?: Comparison) {
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

test("private deep links load the selected branch, exact step, and immutable source links", async ({
  page,
}) => {
  await mock(page);
  await page.goto(
    "/#/project/private-owner/private-project?ref=develop&trail=payment&node=payment.start",
  );
  await expect(
    page.getByRole("heading", { name: "Purchase access", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Repository branch")).toHaveValue("develop");
  await page.getByRole("button", { name: "Find a process or step" }).click();
  await page
    .getByPlaceholder("Search processes and steps…")
    .fill("Evaluate discount");
  await page.locator(".search-results button").first().click();
  await expect(page.getByLabel("Step details")).toBeVisible();
  const link = page.locator(".source-ref a").first();
  await expect(link).toHaveAttribute(
    "href",
    /github\.com\/private-owner\/private-project\/blob\/a{40}\//,
  );
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
  expect(await page.evaluate(() => Object.keys(sessionStorage))).toEqual([]);
});
test("missing maps offer an existing-agent prompt and remain setup-needed after refresh", async ({
  page,
}) => {
  const data = snapshot(await reference());
  delete data.bundle;
  data.status = "missing";
  await mock(page, data);
  await page.goto("/#/project/private-owner/private-project?ref=develop");
  await expect(
    page.getByRole("heading", { name: "Create the first application map" }),
  ).toBeVisible();
  await expect(page.getByLabel("Agent prompt")).toHaveValue(/on develop/);
  await page
    .getByRole("button", { name: "I published the changes · Check again" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Create the first application map" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Agent prompt")).toHaveValue(
    /Preserve existing/,
  );
});
test("revoked access clears private diagrams and search results before showing an error", async ({
  page,
}) => {
  await mock(page);
  await page.goto("/#/project/private-owner/private-project?ref=develop");
  await expect(page.getByText("Understand what happens.")).toBeVisible();
  await page.route(
    "**/api/repositories/private-owner/private-project/access",
    (route) =>
      route.fulfill({
        status: 404,
        json: {
          error: {
            code: "NOT_ACCESSIBLE",
            message: "Access is no longer available.",
          },
        },
      }),
  );
  await page.locator(".process-card").first().click();
  await expect(
    page.getByRole("heading", { name: "Project view unavailable" }),
  ).toBeVisible();
  await expect(page.locator(".viewer")).toHaveCount(0);
  await expect(page.locator(".search-modal")).toHaveCount(0);
});
test("logout removes private content and a shared deep link cannot bypass sign-in", async ({
  page,
}) => {
  await mock(page);
  await page.goto("/#/project/private-owner/private-project?ref=develop");
  await expect(page.locator(".viewer")).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.locator(".viewer")).toHaveCount(0);
  await page.goto("/#/project/private-owner/private-project?ref=develop");
  await expect(
    page.getByRole("link", { name: "Sign in with GitHub" }),
  ).toBeVisible();
  await expect(page.locator(".viewer")).toHaveCount(0);
});
test("repository-authored markup stays text and CSP blocks inline scripts", async ({
  page,
}) => {
  const data = snapshot(await reference());
  data.bundle!.processes[0]!.title = "<img src=x onerror=alert(1)>";
  let dialogs = 0;
  page.on("dialog", (dialog) => {
    dialogs++;
    void dialog.dismiss();
  });
  await mock(page, data);
  const response = await page.goto(
    "/#/project/private-owner/private-project?ref=develop",
  );
  expect(response!.headers()["content-security-policy"]).toContain(
    "script-src 'self'",
  );
  await expect(
    page.getByRole("heading", { name: "<img src=x onerror=alert(1)>" }),
  ).toBeVisible();
  expect(await page.locator(".process-card img").count()).toBe(0);
  expect(dialogs).toBe(0);
});
test("pull request changes preserve previous locations and label closed state", async ({
  page,
}) => {
  const data = snapshot(await reference());
  const base = structuredClone(data);
  base.selectedSha = base.displayedSha = base.source.commitSha = "b".repeat(40);
  const node = base.bundle!.processes.find(
    (process) => process.id === "payment",
  )!.nodes[0]!;
  const comparison: Comparison = {
    number: 7,
    title: "Change payment behavior",
    baseRef: "develop",
    headRef: "feature/discount",
    state: "closed",
    base,
    head: data,
    changes: [
      {
        entity: "node",
        id: node.id,
        kind: "removed",
        title: node.title,
        previousProcessId: "payment",
        before: node,
        fields: [],
      },
    ],
  };
  await mock(page, data, comparison);
  await page.goto("/#/project/private-owner/private-project?ref=develop&pr=7");
  await expect(page.locator(".changes-panel .badge")).toHaveText("closed");
  await page.getByText("1 documented changes", { exact: true }).click();
  await page.getByText(`removed node: ${node.title}`, { exact: true }).click();
  await page.getByRole("button", { name: "Inspect previous location" }).click();
  await expect(page.getByLabel("Step details")).toContainText(node.title);
  await expect(page).toHaveURL(/side=base/);
  await expect(page.locator(".version-strip")).toContainText("bbbbbbbbbbbb");
});

test("a slow previous branch response cannot replace the current selection", async ({
  page,
}) => {
  const first = await mock(page);
  const next = structuredClone(first);
  next.ref = "release/v1";
  next.selectedSha = next.displayedSha = next.source.commitSha = "c".repeat(40);
  let release: (() => void) | undefined;
  await page.route(
    "**/api/repositories/private-owner/private-project/snapshot*",
    async (route) => {
      if (new URL(route.request().url()).searchParams.get("ref") === "develop")
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      await route
        .fulfill({
          json:
            new URL(route.request().url()).searchParams.get("ref") === "develop"
              ? first
              : next,
        })
        .catch(() => undefined);
    },
  );
  await page.goto("/#/project/private-owner/private-project?ref=develop");
  await expect.poll(() => !!release).toBe(true);
  await page.getByLabel("Repository branch").selectOption("release/v1");
  await expect(page.locator(".version-strip")).toContainText("cccccccccccc");
  release!();
  await expect(page.locator(".version-strip")).toContainText("release/v1");
  await expect(page.locator(".version-strip")).not.toContainText(
    "aaaaaaaaaaaa",
  );
});

test("changing the signed-in account remounts private content and checks the new viewer's access", async ({
  page,
}) => {
  await mock(page);
  await page.goto("/#/project/private-owner/private-project?ref=develop");
  await expect(page.locator(".viewer")).toBeVisible();
  await page.route("**/api/session", (route) =>
    route.fulfill({
      json: {
        user: { login: "different-viewer" },
        configured: true,
        csrf: "different-csrf",
        installationUrl: null,
      },
    }),
  );
  await page.route(
    "**/api/repositories/private-owner/private-project/access",
    (route) =>
      route.fulfill({
        status: 404,
        json: {
          error: {
            code: "NOT_ACCESSIBLE",
            message: "Access is unavailable for this account.",
          },
        },
      }),
  );
  await page.evaluate(() => window.dispatchEvent(new Event("pageshow")));
  await expect(
    page.getByRole("heading", { name: "Project view unavailable" }),
  ).toBeVisible();
  await expect(page.locator(".viewer")).toHaveCount(0);
});
