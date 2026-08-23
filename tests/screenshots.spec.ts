import { test, expect } from '@playwright/test';

const USERS = [
  { email: 'kevinkeyman4@gmail.com', password: 'Keyman12345#', role: 'admin', path: '/admin', name: 'Admin' },
  { email: 'kevinalerotek@gmail.com', password: 'Keyman12345#', role: 'receptionist', path: '/staff', name: 'Receptionist' },
  { email: 'keyman.manager@gmail.com', password: 'Keyman12345#', role: 'manager', path: '/manager', name: 'Manager' },
  { email: 'keyman.chef@gmail.com', password: 'Keyman12345#', role: 'chef', path: '/staff', name: 'Chef' },
  { email: 'keyman.waiter@gmail.com', password: 'Keyman12345#', role: 'waiter', path: '/staff', name: 'Waiter' },
  { email: 'keyman.housekeeper@gmail.com', password: 'Keyman12345#', role: 'housekeeper', path: '/staff', name: 'Housekeeper' },
];

async function login(page: any, email: string, password: string, targetPath: string) {
  await page.goto('/login');
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.locator('button[type="submit"], button:has-text("Sign In")').first().click();
  await page.waitForURL((url: URL) => url.pathname.includes(targetPath), { timeout: 20000 });
  await page.waitForTimeout(2000);
}

// Desktop screenshots (1440px)
test.describe('Screenshots — Desktop', () => {
  test('login page', async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.screenshot({ path: 'test-results/screenshots/01-login-desktop.png', fullPage: true });
  });

  for (const user of USERS) {
    test(`${user.name} dashboard — desktop`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await login(page, user.email, user.password, user.path);
      await page.screenshot({ path: `test-results/screenshots/02-${user.name.toLowerCase()}-desktop.png`, fullPage: false });
    });
  }
});

// Mobile screenshots (375px)
test.describe('Screenshots — Mobile', () => {
  test('login page', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/login');
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.screenshot({ path: 'test-results/screenshots/03-login-mobile.png', fullPage: true });
  });

  for (const user of USERS) {
    test(`${user.name} dashboard — mobile`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await login(page, user.email, user.password, user.path);
      await page.screenshot({ path: `test-results/screenshots/04-${user.name.toLowerCase()}-mobile.png`, fullPage: false });
    });
  }
});

// Public pages
test.describe('Screenshots — Public', () => {
  test('homepage — desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'test-results/screenshots/05-homepage-desktop.png', fullPage: true });
  });

  test('homepage — mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'test-results/screenshots/06-homepage-mobile.png', fullPage: true });
  });

  test('rooms page', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/rooms');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'test-results/screenshots/07-rooms-desktop.png', fullPage: true });
  });
});
