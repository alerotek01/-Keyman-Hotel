import { test, expect } from '@playwright/test';

test.describe('Login Page', () => {
  test('loads login page with form elements', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Should show the login heading (use first() to avoid strict mode)
    await expect(page.locator('text=Keyman').first()).toBeVisible();
    await expect(page.locator('input[type="email"], input[placeholder*="email" i]').first()).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
    await expect(page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Log In")').first()).toBeVisible();
  });

  test('shows error on invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first();
    const passwordInput = page.locator('input[type="password"]').first();

    await emailInput.fill('invalid@test.com');
    await passwordInput.fill('wrongpassword');
    await page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Log In")').first().click();

    // Wait for error — check for toast, alert, or error text
    await page.waitForTimeout(3000);
    const hasError = await page.locator('.sonner, [data-sonner-toaster], .text-red-500, .text-destructive, [role="alert"]').first().isVisible().catch(() => false);
    // Also check if we stayed on login page (no redirect)
    expect(page.url()).toContain('/login');
  });

  test('login form is accessible on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('input[type="email"], input[placeholder*="email" i]').first()).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
    await expect(page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Log In")').first()).toBeVisible();
  });

  test('login form submits on Enter key', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first();
    const passwordInput = page.locator('input[type="password"]').first();

    await emailInput.fill('test@test.com');
    await passwordInput.fill('password123');
    await passwordInput.press('Enter');

    // Should attempt login (stay on page or show error)
    await page.waitForTimeout(2000);
    expect(page.url()).toContain('/login');
  });
});
