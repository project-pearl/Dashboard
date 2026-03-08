import { test, expect } from '@playwright/test';

test.describe('Federal dashboard', () => {
  test.skip(!process.env.TEST_FEDERAL_EMAIL, 'Requires TEST_FEDERAL_EMAIL env var');

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder(/email/i).fill(process.env.TEST_FEDERAL_EMAIL!);
    await page.getByPlaceholder(/password/i).fill(process.env.TEST_FEDERAL_PASSWORD!);
    await page.getByRole('button', { name: /sign in|log in|login/i }).click();
    await page.waitForURL('**/dashboard/**', { timeout: 15000 });
  });

  test('dashboard renders after login', async ({ page }) => {
    await expect(page).toHaveURL(/dashboard/);
    // Should see some dashboard content
    await expect(page.locator('body')).toContainText(/overview|dashboard|water/i);
  });

  test('lens navigation works', async ({ page }) => {
    // Try clicking on Compliance lens if visible in sidebar
    const complianceLink = page.getByRole('link', { name: /compliance/i }).or(
      page.getByText(/compliance/i),
    );
    if (await complianceLink.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      await complianceLink.first().click();
      await page.waitForTimeout(1000);
      // Should see NPDES or compliance-related content
      await expect(page.locator('body')).toContainText(/NPDES|compliance|violation/i);
    }
  });
});
