import { test, expect } from '@playwright/test';

test.describe('Login', () => {
  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login/);
  });

  test('shows login form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /Mahendra Saree House/i })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: /Sign In/i })).toBeVisible();
  });

  test.skip(!process.env.E2E_ADMIN_EMAIL, 'requires E2E_ADMIN_EMAIL env var');

  test('admin login redirects to dashboard', async ({ page }) => {
    test.skip(!process.env.E2E_ADMIN_EMAIL, 'requires credentials');

    await page.goto('/login');
    await page.getByLabel('Email').fill(process.env.E2E_ADMIN_EMAIL!);
    await page.getByLabel('Password').fill(process.env.E2E_ADMIN_PASSWORD!);
    await page.getByRole('button', { name: /Sign In/i }).click();
    await expect(page).toHaveURL(/\/admin/);
  });
});
