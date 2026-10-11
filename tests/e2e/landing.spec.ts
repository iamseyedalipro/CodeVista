import { test, expect } from "@playwright/test";
import { mock } from "./fixtures";

test("public home survives a failed session and keeps private data out", async ({
  page,
}) => {
  await page.route("**/api/session", (route) =>
    route.fulfill({ status: 503, json: { error: "Unavailable" } }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "See the logic. Understand the system.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Retry connection" }),
  ).toBeVisible();
  await expect(page.locator(".repo-card, .viewer")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Connect GitHub" })).toHaveCount(
    0,
  );
});

test("signed-in users can visit Home and return to Projects", async ({
  page,
}) => {
  await mock(page);
  await page.goto("/#/projects");
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await expect(page.locator(".landing")).toBeVisible();
  await page.getByRole("link", { name: "Open your workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Projects", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".landing")).toHaveCount(0);
});

for (const width of [375, 1440]) {
  test(`landing at ${width}px has working branding, connection, and no horizontal overflow`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/api/session", (route) =>
      route.fulfill({
        json: { user: null, configured: true, installationUrl: null },
      }),
    );
    await page.goto("/");
    await expect(
      page.getByRole("link", { name: "Connect GitHub" }),
    ).toHaveAttribute("href", "/auth/github");
    await expect(page.locator(".hero-art img")).toHaveJSProperty(
      "naturalWidth",
      512,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`landing-${width}.png`),
      fullPage: true,
    });
    await page.getByLabel("Color theme").selectOption("dark");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`landing-${width}-dark.png`),
      fullPage: true,
    });
  });
}
