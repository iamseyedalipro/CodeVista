import { test, expect } from "@playwright/test";
import { mock, snapshot } from "./fixtures";
import { scaleSample } from "../../src/scale";

test.beforeEach(async ({ page }) => {
  await mock(page);
});

test("overview, step details, shared subprocesses, and browser history", async ({
  page,
}) => {
  await page.goto("/#/project/private-owner/private-project?ref=develop");
  await expect(
    page.getByRole("heading", { name: "Understand what happens." }),
  ).toBeVisible();
  await page
    .locator(".process-card")
    .filter({ hasText: "Respond to a message" })
    .click();
  await expect(page.locator(".process-heading h1")).toHaveText(
    "Respond to a message",
  );
  await page
    .locator(".react-flow__node strong")
    .filter({ hasText: "Check subscription" })
    .click();
  await expect(
    page.getByRole("complementary", { name: "Step details" }),
  ).toBeVisible();
  await expect(page.locator(".process-heading h1")).toHaveText(
    "Respond to a message",
  );
  await page
    .locator(".details")
    .getByRole("button", { name: /Open subprocess/ })
    .click();
  await expect(page.locator(".process-heading h1")).toHaveText(
    "Check subscription",
  );
  await expect(
    page.getByRole("navigation", { name: "Breadcrumb" }),
  ).toContainText("Respond to a message");
  await page.goBack();
  await expect(page.locator(".process-heading h1")).toHaveText(
    "Respond to a message",
  );
  await page.getByRole("button", { name: "Back one level" }).click();
  await expect(page.locator(".overview h1")).toBeVisible();
});

test("search reaches a deep process and direct links reload the same location", async ({
  page,
}) => {
  await page.goto("/#/project/private-owner/private-project?ref=develop");
  await page.getByRole("button", { name: /Find a process/ }).click();
  await page
    .getByPlaceholder("Search processes and steps…")
    .fill("Check discount eligibility");
  await page.locator(".search-results button").first().click();
  await expect(page.locator(".process-heading h1")).toHaveText(
    "Check discount eligibility",
  );
  await expect(
    page.getByRole("navigation", { name: "Breadcrumb" }),
  ).toContainText("Purchase access");
  await page.reload();
  await expect(page.locator(".process-heading h1")).toHaveText(
    "Check discount eligibility",
  );
  await page.getByRole("button", { name: /Open subprocess/ }).click();
  await expect(page.locator(".process-heading h1")).toHaveText(
    "Check subscription",
  );
  await expect(
    page.getByRole("navigation", { name: "Breadcrumb" }),
  ).toContainText("Evaluate discount");
});

test("unknown and planned behavior remain explicit; invalid links do not open another map", async ({
  page,
}) => {
  await page.goto(
    "/#/project/private-owner/private-project?ref=develop&trail=analytics",
  );
  await expect(
    page.getByRole("heading", { name: "This area has not been reviewed" }),
  ).toBeVisible();
  await page.goto(
    "/#/project/private-owner/private-project?ref=develop&trail=missing",
  );
  await expect(
    page.getByRole("heading", { name: "Process unavailable" }),
  ).toBeVisible();
  await page.goto(
    "/#/project/private-owner/private-project?ref=develop&trail=translation",
  );
  await expect(page.locator(".process-heading .badge")).toHaveText("planned");
});

test("small screens retain navigation, search, details, and readable text", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#/project/private-owner/private-project?ref=develop");
  await expect(page.locator(".process-card").first()).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.goto(
    "/#/project/private-owner/private-project?ref=develop&trail=login&node=login.credentials",
  );
  await expect(page.locator(".details h2")).toHaveText(
    "Are credentials valid?",
  );
  await page.locator(".details").scrollIntoViewIfNeeded();
  await expect(page.locator(".details")).toBeInViewport();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});

test("reference overview has no browser errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/#/project/private-owner/private-project?ref=develop");
  await page.screenshot({ path: "test-results/overview.png", fullPage: true });
  await page.goto(
    "/#/project/private-owner/private-project?ref=develop&trail=payment&node=payment.zero",
  );
  await expect(page.locator(".details h2")).toHaveText(
    "Is the amount due zero?",
  );
  await page.screenshot({ path: "test-results/payment.png", fullPage: true });
  expect(errors).toEqual([]);
});

test("scale fixture stays navigable with ten roots and 413 steps", async ({
  page,
}) => {
  const started = Date.now();
  await mock(page, snapshot(scaleSample()));
  await page.goto("/#/project/private-owner/private-project?ref=develop");
  await expect(page.locator(".process-card")).toHaveCount(10);
  await expect(page.locator(".metric-strip")).toContainText("413");
  await page.locator(".process-card").first().click();
  await expect(page.locator(".react-flow__node")).toHaveCount(40);
  expect(Date.now() - started).toBeLessThan(10000);
  await page.getByRole("button", { name: "Find a process or step" }).click();
  await page
    .getByPlaceholder("Search processes and steps…")
    .fill("Deep synthetic process");
  await page.locator(".search-results button").first().click();
  await expect(
    page.getByRole("heading", { name: "Deep synthetic process", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Breadcrumb")).toContainText(
    "Shared synthetic subprocess",
  );
  console.log(
    `Scale fixture: overview, 40-node render, and depth-three search completed in ${Date.now() - started} ms.`,
  );
});

test("fullscreen keeps chart selection and exits with button or Escape", async ({
  page,
}) => {
  await page.goto(
    "/#/project/private-owner/private-project?ref=develop&trail=login&node=login.credentials",
  );
  const chart = page.locator(".flow-canvas");
  await expect(chart).toBeVisible();
  await chart.evaluate((canvas) =>
    canvas.setAttribute("data-mount", "original"),
  );
  await page.getByRole("button", { name: "Expand flowchart" }).click();
  await expect(page.locator(".diagram-fullscreen")).toBeVisible();
  const bounds = await page.locator(".diagram-fullscreen").boundingBox();
  expect(bounds?.width).toBe(page.viewportSize()!.width);
  expect(bounds?.height).toBe(page.viewportSize()!.height);
  await expect(page.getByLabel("Step details")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".diagram-fullscreen")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Expand flowchart" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Expand flowchart" }).click();
  await page.getByRole("button", { name: "Exit fullscreen" }).click();
  await expect(chart).toHaveAttribute("data-mount", "original");
  await expect(page.getByLabel("Step details")).toContainText(
    "Are credentials valid?",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Expand flowchart" }).click();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.keyboard.press("Escape");
});
