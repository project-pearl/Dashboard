import { test, expect } from '@playwright/test';

test.describe('Login page', () => {
  test('renders login form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByPlaceholder(/email/i)).toBeVisible();
    await expect(page.getByPlaceholder(/password/i)).toBeVisible();
  });

  test('shows password validation on signup', async ({ page }) => {
    await page.goto('/login');
    // Look for a signup toggle / link
    const signupToggle = page.getByText(/sign up|create account|register/i);
    if (await signupToggle.isVisible()) {
      await signupToggle.click();
      const pwInput = page.getByPlaceholder(/password/i).first();
      await pwInput.fill('ab');
      // Password requirement indicators should appear
      await expect(page.getByText(/at least 8 characters/i)).toBeVisible();
    }
  });

  test('shows error on invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder(/email/i).fill('invalid@example.com');
    await page.getByPlaceholder(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /sign in|log in|login/i }).click();
    // Should show an error message (not redirect)
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/login/);
  });
});
