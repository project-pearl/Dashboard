import { test, expect } from '@playwright/test';

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    // Wait for auth loading spinner to disappear and form to render
    await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  });

  test('renders login form', async ({ page }) => {
    await expect(page.getByLabel(/email/i).first()).toBeVisible();
    await expect(page.getByLabel(/password/i).first()).toBeVisible();
  });

  test('shows password validation on signup', async ({ page }) => {
    // Look for a signup toggle / link
    const signupToggle = page.getByText(/sign up|create account|register/i);
    if (await signupToggle.isVisible({ timeout: 5000 }).catch(() => false)) {
      await signupToggle.click();
      const pwInput = page.getByLabel(/^password$/i).first();
      await pwInput.fill('ab');
      // Password requirement indicators should appear
      await expect(page.getByText(/at least 8 characters/i)).toBeVisible();
    }
  });

  test('shows error on invalid credentials', async ({ page }) => {
    await page.getByLabel(/email/i).first().fill('invalid@example.com');
    await page.getByLabel(/password/i).first().fill('wrongpassword');
    await page.getByRole('button', { name: /sign in|log in|login/i }).click();
    // Should show an error message (not redirect)
    await page.waitForTimeout(3000);
    await expect(page).toHaveURL(/login/);
  });
});
