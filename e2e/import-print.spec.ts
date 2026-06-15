import { test, expect } from '@playwright/test';

test.describe('Import and Print', () => {
  test.skip(!process.env.E2E_SUPPLIER_EMAIL, 'requires E2E_SUPPLIER_EMAIL env var');

  test('supplier can access import page', async ({ page }) => {
    test.skip(!process.env.E2E_SUPPLIER_EMAIL, 'requires credentials');

    await page.goto('/login');
    await page.getByLabel('Email').fill(process.env.E2E_SUPPLIER_EMAIL!);
    await page.getByLabel('Password').fill(process.env.E2E_SUPPLIER_PASSWORD!);
    await page.getByRole('button', { name: /Sign In/i }).click();
    await expect(page).toHaveURL(/\/supplier/);

    await page.goto('/supplier/import');
    await expect(page.getByRole('heading', { name: /Import Tally Bill/i })).toBeVisible();
  });

  test('supplier can access print page', async ({ page }) => {
    test.skip(!process.env.E2E_SUPPLIER_EMAIL, 'requires credentials');

    await page.goto('/login');
    await page.getByLabel('Email').fill(process.env.E2E_SUPPLIER_EMAIL!);
    await page.getByLabel('Password').fill(process.env.E2E_SUPPLIER_PASSWORD!);
    await page.getByRole('button', { name: /Sign In/i }).click();

    await page.goto('/supplier/print');
    await expect(page.getByRole('heading', { name: /Print Barcodes/i })).toBeVisible();
  });
});
