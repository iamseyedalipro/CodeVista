import { test, expect, type Page } from "@playwright/test";
import type { Comparison } from "../../src/snapshot-types";
import { mock, reference, snapshot } from "./fixtures";

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
    page.getByRole("link", { name: "Connect GitHub" }),
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

test("routine access checks and step navigation preserve the mounted chart", async ({
  page,
}) => {
  await page.clock.install();
  await mock(page);
  let snapshots = 0;
  let checks = 0;
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (path.endsWith("/snapshot")) snapshots++;
    if (path.endsWith("/access")) checks++;
  });
  await page.goto(
    "/#/project/private-owner/private-project?ref=develop&trail=payment",
  );
  await expect(page.locator(".flow-canvas")).toBeVisible();
  await page
    .locator(".flow-canvas")
    .evaluate((canvas) => canvas.setAttribute("data-mount", "original"));
  await page.clock.fastForward(61000);
  await expect.poll(() => checks).toBeGreaterThan(1);
  await expect(page.locator(".flow-canvas")).toHaveAttribute(
    "data-mount",
    "original",
  );
  expect(snapshots).toBe(1);
  await page.locator(".react-flow__node strong").first().click();
  await expect(page.getByLabel("Step details")).toBeVisible();
  await expect(page.locator(".flow-canvas")).toHaveAttribute(
    "data-mount",
    "original",
  );
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect.poll(() => snapshots).toBe(2);
  await expect(page.locator(".flow-canvas")).toBeVisible();
  await page.route(
    "**/api/repositories/private-owner/private-project/access",
    (route) =>
      route.fulfill({
        status: 404,
        json: { error: { code: "NOT_ACCESSIBLE", message: "Access revoked." } },
      }),
  );
  await page.clock.fastForward(61000);
  await expect(
    page.getByRole("heading", { name: "Project view unavailable" }),
  ).toBeVisible();
  await expect(page.locator(".viewer")).toHaveCount(0);
});

test("session channel initialization and received notifications do not echo", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const Original = window.BroadcastChannel;
    (window as any).sessionMessages = [];
    window.BroadcastChannel = class extends Original {
      postMessage(value: unknown) {
        (window as any).sessionMessages.push(value);
        super.postMessage(value);
      }
    };
  });
  await mock(page);
  await page.goto(
    "/#/project/private-owner/private-project?ref=develop&trail=payment",
  );
  await expect(page.locator(".flow-canvas")).toBeVisible();
  expect(await page.evaluate(() => (window as any).sessionMessages)).toEqual(
    [],
  );
  const refreshed = page.waitForResponse("**/api/session");
  await page.evaluate(() => {
    const channel = new BroadcastChannel("codevista-session");
    channel.postMessage("identity-changed");
    channel.close();
  });
  await refreshed;
  await expect(page.locator(".flow-canvas")).toBeVisible();
  expect(await page.evaluate(() => (window as any).sessionMessages)).toEqual([
    "identity-changed",
  ]);
});

for (const path of ["/", "/#/demo/after?trail=payment", "/#/unknown"]) {
  test(`anonymous landing ${path} offers GitHub connection without examples`, async ({
    page,
  }) => {
    let repositoryRequests = 0;
    await page.route("**/api/**", (route) => {
      if (new URL(route.request().url()).pathname !== "/api/session")
        repositoryRequests++;
      return route.fulfill({
        json: { user: null, configured: true, installationUrl: null },
      });
    });
    await page.goto(path);
    await expect(
      page.getByRole("link", { name: "Connect GitHub" }),
    ).toHaveAttribute("href", "/auth/github");
    await expect(page.locator(".viewer, .repo-card")).toHaveCount(0);
    await expect(page.getByLabel("Example version")).toHaveCount(0);
    await expect(page.getByText("Synthetic reference application")).toHaveCount(
      0,
    );
    expect(repositoryRequests).toBe(0);
  });
}

test("connected landing lists the user's projects and opens their selection", async ({
  page,
}) => {
  await mock(page);
  await page.route("**/api/repositories", (route) =>
    route.fulfill({
      json: {
        repositories: ["private-project", "second-project"].map(
          (name, index) => ({
            id: index + 10,
            fullName: `private-owner/${name}`,
            defaultBranch: "develop",
            selectedBranch: "develop",
            private: true,
            disconnected: false,
            lastVisitedAt: null,
          }),
        ),
      },
    }),
  );
  await page.goto("/");
  await expect(page.locator(".repo-card")).toHaveCount(2);
  await expect(page.locator(".viewer")).toHaveCount(0);
  await page
    .locator(".repo-card")
    .filter({ hasText: "private-owner/private-project" })
    .getByRole("link", { name: "Open project" })
    .click();
  await expect(page.locator(".viewer")).toBeVisible();
  await page.locator(".brand").click();
  await expect(page.locator(".repo-card")).toHaveCount(2);
  await expect(page.locator(".viewer")).toHaveCount(0);
});

test("connected users with no repositories receive setup guidance without an example", async ({
  page,
}) => {
  await mock(page);
  await page.route("**/api/repositories", (route) =>
    route.fulfill({ json: { repositories: [] } }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "No authorized repositories yet" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Install or manage/ }),
  ).toBeVisible();
  await expect(page.locator(".viewer, .repo-card")).toHaveCount(0);
});

test("unconfigured hosts explain how to enable GitHub connections", async ({
  page,
}) => {
  await page.route("**/api/session", (route) =>
    route.fulfill({
      json: { user: null, configured: false, installationUrl: null },
    }),
  );
  await page.goto("/");
  await expect(
    page.getByText(/This host has not configured its GitHub App/),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Connect GitHub" })).toHaveCount(
    0,
  );
  await expect(page.locator(".viewer")).toHaveCount(0);
});
