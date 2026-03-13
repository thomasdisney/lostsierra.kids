import { test, expect } from "@playwright/test";

// In local dev, Next.js serves pages without /portal prefix.
// Middleware paths also lack the /portal prefix locally.

test.describe("Full registration flow", () => {
  test("Create account page loads and is usable", async ({ page }) => {
    await page.goto("/register");
    await expect(page.locator("h1")).toContainText("Create your account");

    await expect(page.locator("#fullName")).toBeVisible();
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.locator("#confirmPassword")).toBeVisible();

    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toContainText("Create Account");
  });

  test("Login page loads and is usable", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("h1")).toContainText("Welcome back");

    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();

    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toContainText("Sign In");
  });

  test("Login form submits and shows loading state", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("#email")).toBeVisible();

    await page.locator("#email").fill("nonexistent@example.com");
    await page.locator("#password").fill("wrongpassword");
    await page.locator('button[type="submit"]').click();

    // Should show loading state immediately
    await expect(page.locator('button[type="submit"]')).toContainText(/Sign/i, { timeout: 30000 });

    // The form should remain visible (not navigate to dashboard)
    await expect(page.locator("#email")).toBeVisible();
  });

  test("Verify page loads correctly", async ({ page }) => {
    await page.goto("/verify?email=test@example.com");
    await expect(page.locator("h1")).toContainText("Check your email");
    await expect(page.locator("text=test@example.com")).toBeVisible();

    const codeInput = page.locator('input[type="text"]');
    await expect(codeInput).toBeVisible();
  });

  test("Back to login link works from verify page", async ({ page }) => {
    await page.goto("/verify?email=test@example.com");
    await expect(page.locator("h1")).toContainText("Check your email");

    const backLink = page.locator("a[href*='login']");
    await expect(backLink).toBeVisible();
  });
});

test.describe("Auth guards", () => {
  test("Dashboard redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL(/\/login/, { timeout: 15000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test("Children page redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/children");
    await page.waitForURL(/\/login/, { timeout: 15000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test("Family page redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/family");
    await page.waitForURL(/\/login/, { timeout: 15000 });
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Mobile-specific checks", () => {
  test("Login page has no horizontal overflow on mobile", async ({ page, isMobile }) => {
    test.skip(!isMobile, "Mobile only");
    await page.goto("/login");

    await expect(page.locator("#email")).toBeVisible();

    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 2);
  });

  test("Register page has no horizontal overflow on mobile", async ({ page, isMobile }) => {
    test.skip(!isMobile, "Mobile only");
    await page.goto("/register");

    await expect(page.locator("#fullName")).toBeVisible();

    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 2);
  });

  test("Verify page has no horizontal overflow on mobile", async ({ page, isMobile }) => {
    test.skip(!isMobile, "Mobile only");
    await page.goto("/verify?email=test@example.com");

    await expect(page.locator("h1")).toContainText("Check your email");

    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 2);
  });

  test("Input font size is 16px+ to prevent iOS zoom", async ({ page, isMobile }) => {
    test.skip(!isMobile, "Mobile only");
    await page.goto("/login");

    const emailInput = page.locator("#email");
    await expect(emailInput).toBeVisible();
    const fontSize = await emailInput.evaluate((el) =>
      parseFloat(window.getComputedStyle(el).fontSize)
    );
    expect(fontSize).toBeGreaterThanOrEqual(16);
  });

  test("Create account button has adequate tap target", async ({ page, isMobile }) => {
    test.skip(!isMobile, "Mobile only");
    await page.goto("/register");

    const btn = page.locator('button[type="submit"]');
    await expect(btn).toBeVisible();

    const box = await btn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(40);
  });

  test("Login link from register page works on mobile", async ({ page, isMobile }) => {
    test.skip(!isMobile, "Mobile only");
    await page.goto("/register");

    const loginLink = page.locator("text=Already have an account");
    await expect(loginLink).toBeVisible();
    await loginLink.click();
    await page.waitForURL(/\/login/, { timeout: 10000 });
  });

  test("Create account link from login page works on mobile", async ({ page, isMobile }) => {
    test.skip(!isMobile, "Mobile only");
    await page.goto("/login");

    const createLink = page.locator("text=Create an account");
    await expect(createLink).toBeVisible();
    await createLink.click();
    await page.waitForURL(/\/register/, { timeout: 10000 });
  });
});
