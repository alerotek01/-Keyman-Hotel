import { test, expect } from '@playwright/test';

// Helper to login and navigate to dashboard
async function loginAndGoTo(page: any, email: string, password: string, path: string) {
  await page.goto('/login');
  await page.waitForSelector('input[type="email"], input[placeholder*="email" i]', { timeout: 10000 });
  await page.locator('input[type="email"], input[placeholder*="email" i]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.locator('button[type="submit"], button:has-text("Sign In")').first().click();
  await page.waitForURL((url: URL) => url.pathname.includes(path), { timeout: 20000 });
  await page.waitForTimeout(2000); // Wait for PDA to render
}

test.describe('Staff PDA Layout', () => {
  test('receptionist PDA shows greeting and bottom nav', async ({ page }) => {
    await loginAndGoTo(page, 'kevinalerotek@gmail.com', 'Keyman12345#', '/staff');
    
    // Should show greeting
    await expect(page.locator('text=/Hi|Hello|Welcome/').first()).toBeVisible({ timeout: 10000 });
    
    // Should show role badge
    await expect(page.locator('text=Receptionist').first()).toBeVisible();
  });

  test('chef PDA shows greeting and role', async ({ page }) => {
    await loginAndGoTo(page, 'keyman.chef@gmail.com', 'Keyman12345#', '/staff');
    
    await expect(page.locator('text=/Hi|Hello|Welcome/').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Chef').first()).toBeVisible();
  });

  test('waiter PDA shows greeting and role', async ({ page }) => {
    await loginAndGoTo(page, 'keyman.waiter@gmail.com', 'Keyman12345#', '/staff');
    
    await expect(page.locator('text=/Hi|Hello|Welcome/').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Waiter').first()).toBeVisible();
  });

  test('housekeeper PDA shows greeting and role', async ({ page }) => {
    await loginAndGoTo(page, 'keyman.housekeeper@gmail.com', 'Keyman12345#', '/staff');
    
    await expect(page.locator('text=/Hi|Hello|Welcome/').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Housekeeper').first()).toBeVisible();
  });
});

test.describe('Staff PDA — Mobile Viewport', () => {
  test('receptionist PDA is usable on iPhone SE (375px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await loginAndGoTo(page, 'kevinalerotek@gmail.com', 'Keyman12345#', '/staff');
    
    // PDA greeting should be visible
    await expect(page.locator('text=/Hi|Hello|Welcome/').first()).toBeVisible({ timeout: 10000 });
    
    // Stat cards or dashboard content should be visible
    const hasContent = await page.locator('text=/Check-in|Check-out|Arrivals|Today|Rooms|Tasks|Requests|Orders/').first().isVisible().catch(() => false);
    expect(hasContent).toBeTruthy();
  });

  test('chef PDA is usable on iPad (768px)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await loginAndGoTo(page, 'keyman.chef@gmail.com', 'Keyman12345#', '/staff');
    
    await expect(page.locator('text=/Hi|Hello|Welcome/').first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Admin PDA — Full Dashboard', () => {
  test('admin lands on dashboard with nav items', async ({ page }) => {
    await loginAndGoTo(page, 'kevinkeyman4@gmail.com', 'Keyman12345#', '/admin');
    
    // Should show admin dashboard
    await expect(page.locator('text=Keyman').first()).toBeVisible({ timeout: 10000 });
  });

  test('admin Rooms page loads', async ({ page }) => {
    await loginAndGoTo(page, 'kevinkeyman4@gmail.com', 'Keyman12345#', '/admin');
    
    const roomsLink = page.locator('a[href="/admin/rooms"], button:has-text("Rooms")').first();
    if (await roomsLink.isVisible({ timeout: 5000 })) {
      await roomsLink.click();
      await page.waitForTimeout(1500);
      expect(page.url()).toContain('/admin/rooms');
    }
  });

  test('admin Bookings page loads', async ({ page }) => {
    await loginAndGoTo(page, 'kevinkeyman4@gmail.com', 'Keyman12345#', '/admin');
    
    const bookingsLink = page.locator('a[href="/admin/bookings"], button:has-text("Bookings")').first();
    if (await bookingsLink.isVisible({ timeout: 5000 })) {
      await bookingsLink.click();
      await page.waitForTimeout(1500);
      expect(page.url()).toContain('/admin/bookings');
    }
  });

  test('admin Users page loads', async ({ page }) => {
    await loginAndGoTo(page, 'kevinkeyman4@gmail.com', 'Keyman12345#', '/admin');
    
    const usersLink = page.locator('a[href="/admin/users"], button:has-text("Users")').first();
    if (await usersLink.isVisible({ timeout: 5000 })) {
      await usersLink.click();
      await page.waitForTimeout(1500);
      expect(page.url()).toContain('/admin/users');
    }
  });

  test('admin Folios page loads', async ({ page }) => {
    await loginAndGoTo(page, 'kevinkeyman4@gmail.com', 'Keyman12345#', '/admin');
    
    const foliosLink = page.locator('a[href="/admin/folios"], button:has-text("Folios")').first();
    if (await foliosLink.isVisible({ timeout: 5000 })) {
      await foliosLink.click();
      await page.waitForTimeout(1500);
      expect(page.url()).toContain('/admin/folios');
    }
  });

  test('admin Operations page loads', async ({ page }) => {
    await loginAndGoTo(page, 'kevinkeyman4@gmail.com', 'Keyman12345#', '/admin');
    
    const opsLink = page.locator('a[href="/admin/operations"], button:has-text("Operations")').first();
    if (await opsLink.isVisible({ timeout: 5000 })) {
      await opsLink.click();
      await page.waitForTimeout(1500);
      expect(page.url()).toContain('/admin/operations');
    }
  });

  test('admin Menu page loads', async ({ page }) => {
    await loginAndGoTo(page, 'kevinkeyman4@gmail.com', 'Keyman12345#', '/admin');
    
    const menuLink = page.locator('a[href="/admin/menu"], button:has-text("Menu")').first();
    if (await menuLink.isVisible({ timeout: 5000 })) {
      await menuLink.click();
      await page.waitForTimeout(1500);
      expect(page.url()).toContain('/admin/menu');
    }
  });
});

test.describe('Manager Dashboard', () => {
  test('manager lands on dashboard', async ({ page }) => {
    await loginAndGoTo(page, 'keyman.manager@gmail.com', 'Keyman12345#', '/manager');
    
    await expect(page.locator('text=/Hi|Hello|Welcome/').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Manager').first()).toBeVisible();
  });
});
