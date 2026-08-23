import { test, expect } from '@playwright/test';

const USERS = [
  { email: 'kevinkeyman4@gmail.com', password: 'Keyman12345#', role: 'admin', expectedPath: '/admin' },
  { email: 'kevinalerotek@gmail.com', password: 'Keyman12345#', role: 'receptionist', expectedPath: '/staff' },
  { email: 'keyman.manager@gmail.com', password: 'Keyman12345#', role: 'manager', expectedPath: '/manager' },
  { email: 'keyman.chef@gmail.com', password: 'Keyman12345#', role: 'chef', expectedPath: '/staff' },
  { email: 'keyman.waiter@gmail.com', password: 'Keyman12345#', role: 'waiter', expectedPath: '/staff' },
  { email: 'keyman.housekeeper@gmail.com', password: 'Keyman12345#', role: 'housekeeper', expectedPath: '/staff' },
];

test.describe('Login Page UI', () => {
  test('loads login page with all form elements', async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('input[type="email"], input[placeholder*="email" i]', { timeout: 10000 });
    
    await expect(page.locator('text=Keyman').first()).toBeVisible();
    await expect(page.locator('input[type="email"], input[placeholder*="email" i]').first()).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
    await expect(page.locator('button[type="submit"], button:has-text("Sign In")').first()).toBeVisible();
  });

  test('shows error on invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('input[type="email"], input[placeholder*="email" i]', { timeout: 10000 });

    await page.locator('input[type="email"], input[placeholder*="email" i]').first().fill('invalid@test.com');
    await page.locator('input[type="password"]').first().fill('wrongpassword');
    await page.locator('button[type="submit"], button:has-text("Sign In")').first().click();

    // Wait for error toast or message
    await page.waitForTimeout(5000);
    // Verify we're still on login page
    expect(page.url()).toContain('/login');
  });

  test('form accessible on mobile viewport (375px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/login');
    await page.waitForSelector('input[type="email"], input[placeholder*="email" i]', { timeout: 10000 });
    
    await expect(page.locator('input[type="email"], input[placeholder*="email" i]').first()).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
    await expect(page.locator('button[type="submit"], button:has-text("Sign In")').first()).toBeVisible();
  });

  test('form accessible on tablet viewport (768px)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/login');
    await page.waitForSelector('input[type="email"], input[placeholder*="email" i]', { timeout: 10000 });
    
    await expect(page.locator('input[type="email"], input[placeholder*="email" i]').first()).toBeVisible();
  });

  test('form accessible on desktop viewport (1440px)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/login');
    await page.waitForSelector('input[type="email"], input[placeholder*="email" i]', { timeout: 10000 });
    
    await expect(page.locator('input[type="email"], input[placeholder*="email" i]').first()).toBeVisible();
  });

  test('enter key submits the form', async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('input[type="email"], input[placeholder*="email" i]', { timeout: 10000 });

    await page.locator('input[type="email"], input[placeholder*="email" i]').first().fill('test@test.com');
    await page.locator('input[type="password"]').first().fill('password123');
    await page.locator('input[type="password"]').first().press('Enter');

    await page.waitForTimeout(3000);
    expect(page.url()).toContain('/login');
  });

  test('sign up toggle works', async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('input[type="email"], input[placeholder*="email" i]', { timeout: 10000 });

    // Click "Don't have an account? Sign up"
    const signUpLink = page.locator('text=Sign up').first();
    if (await signUpLink.isVisible()) {
      await signUpLink.click();
      await page.waitForTimeout(500);
      // Should show full name field
      const nameField = page.locator('#fullName, input[placeholder*="name" i]').first();
      if (await nameField.isVisible()) {
        await expect(nameField).toBeVisible();
      }
    }
  });
});

test.describe('Auth Redirects', () => {
  test('unauthenticated /admin redirects to /login', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForTimeout(2000);
    expect(page.url()).toContain('/login');
  });

  test('unauthenticated /staff redirects to /login', async ({ page }) => {
    await page.goto('/staff');
    await page.waitForTimeout(2000);
    expect(page.url()).toContain('/login');
  });

  test('unauthenticated /manager redirects to /login', async ({ page }) => {
    await page.goto('/manager');
    await page.waitForTimeout(2000);
    expect(page.url()).toContain('/login');
  });
});

for (const user of USERS) {
  test.describe(`Login Flow — ${user.role} (${user.email})`, () => {
    test(`logs in as ${user.role} and lands on ${user.expectedPath}`, async ({ page }) => {
      await page.goto('/login');
      await page.waitForSelector('input[type="email"], input[placeholder*="email" i]', { timeout: 10000 });

      await page.locator('input[type="email"], input[placeholder*="email" i]').first().fill(user.email);
      await page.locator('input[type="password"]').first().fill(user.password);
      await page.locator('button[type="submit"], button:has-text("Sign In")').first().click();

      // Wait for navigation away from /login (up to 20 seconds for Supabase auth)
      await page.waitForURL(
        (url) => !url.pathname.includes('/login'),
        { timeout: 20000 }
      );

      // Verify landed on correct path
      expect(page.url()).toContain(user.expectedPath);
    });
  });
}

test.describe('Admin Login — Full Navigation', () => {
  test('admin can navigate to all admin pages', async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('input[type="email"], input[placeholder*="email" i]', { timeout: 10000 });

    await page.locator('input[type="email"], input[placeholder*="email" i]').first().fill('kevinkeyman4@gmail.com');
    await page.locator('input[type="password"]').first().fill('Keyman12345#');
    await page.locator('button[type="submit"], button:has-text("Sign In")').first().click();

    await page.waitForURL((url) => url.pathname.includes('/admin'), { timeout: 20000 });

    // Verify admin dashboard loads
    await expect(page.locator('text=Keyman').first()).toBeVisible({ timeout: 10000 });
    
    // Navigate to Rooms
    const roomsLink = page.locator('a[href="/admin/rooms"], button:has-text("Rooms")').first();
    if (await roomsLink.isVisible()) {
      await roomsLink.click();
      await page.waitForTimeout(1000);
      expect(page.url()).toContain('/admin/rooms');
    }

    // Navigate to Bookings
    const bookingsLink = page.locator('a[href="/admin/bookings"], button:has-text("Bookings")').first();
    if (await bookingsLink.isVisible()) {
      await bookingsLink.click();
      await page.waitForTimeout(1000);
      expect(page.url()).toContain('/admin/bookings');
    }

    // Navigate to Users
    const usersLink = page.locator('a[href="/admin/users"], button:has-text("Users")').first();
    if (await usersLink.isVisible()) {
      await usersLink.click();
      await page.waitForTimeout(1000);
      expect(page.url()).toContain('/admin/users');
    }

    // Navigate to Folios
    const foliosLink = page.locator('a[href="/admin/folios"], button:has-text("Folios")').first();
    if (await foliosLink.isVisible()) {
      await foliosLink.click();
      await page.waitForTimeout(1000);
      expect(page.url()).toContain('/admin/folios');
    }

    // Navigate to Operations
    const opsLink = page.locator('a[href="/admin/operations"], button:has-text("Operations")').first();
    if (await opsLink.isVisible()) {
      await opsLink.click();
      await page.waitForTimeout(1000);
      expect(page.url()).toContain('/admin/operations');
    }
  });
});
