import { test, expect } from "@playwright/test";
import { mock } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await mock(page);
});

test("theme follows system, persists an override, and synchronizes tabs", async ({
  page,
  context,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/#/project/private-owner/private-project?ref=develop");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator(".app-header")).toHaveCSS(
    "background-color",
    "rgb(35, 35, 33)",
  );
  await page.getByLabel("Color theme").selectOption("light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  const other = await context.newPage();
  await other.goto("/#/help");
  await expect(other.getByLabel("Color theme")).toHaveValue("light");
  await page.getByLabel("Color theme").selectOption("dark");
  await expect(other.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(other.getByLabel("Color theme")).toHaveValue("dark");
  await page.getByLabel("Color theme").selectOption("system");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page
    .locator(".process-card")
    .filter({ hasText: "Respond to a message" })
    .click();
  await expect(page.locator(".stage").first()).toHaveCSS(
    "background-color",
    "rgb(35, 35, 33)",
  );
  await expect(page.locator(".react-flow__edge-text").first()).toHaveCSS(
    "fill",
    "rgb(243, 241, 235)",
  );
});

test("blocked storage does not prevent theme changes or navigation", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("Storage blocked");
      },
    });
  });
  await page.goto("/#/projects");
  await page.getByLabel("Color theme").selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("link", { name: "Guide & privacy" }).click();
  await expect(page.getByLabel("Color theme")).toHaveValue("dark");
});
