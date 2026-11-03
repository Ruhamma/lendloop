import { expect, test } from "@playwright/test";

test("public page shows the pitch, the sign-in button and live tools", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Borrow what you need");
  await expect(page.getByRole("button", { name: "Sign in to lend or borrow" })).toBeVisible();
  // The list comes from Convex over a WebSocket, so this proves the data connection works.
  await expect(page.getByRole("heading", { name: "Available now" })).toBeVisible();
  await expect(page.locator("main li").first()).toBeVisible();
});

test("public tool cards never show owner details", async ({ page }) => {
  await page.goto("/");
  await page.locator("main li").first().waitFor();
  const text = await page.locator("main").innerText();
  expect(text).not.toMatch(/@|\bby [A-Z]/);
});

test("sign-in button opens Clerk", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in to lend or borrow" }).click();
  await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
});

test("the dashboard sends signed-out visitors to sign in", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/sign-in/);
});

test("security headers are set", async ({ request }) => {
  const res = await request.get("/");
  const headers = res.headers();
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-powered-by"]).toBeUndefined();
});

test("n8n endpoints reject unsigned calls", async ({ request }) => {
  const site = process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? "http://127.0.0.1:3211";
  const res = await request.get(`${site}/n8n/overdue-loans`);
  expect(res.status()).toBe(401);
});
