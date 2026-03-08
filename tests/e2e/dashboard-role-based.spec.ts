import { test, expect } from '@playwright/test';

test.describe('Role-based dashboard routing', () => {
  test.skip(
    !process.env.TEST_FEDERAL_EMAIL,
    'Requires test account env vars',
  );

  const testCases = [
    {
      role: 'federal',
      emailEnv: 'TEST_FEDERAL_EMAIL',
      passwordEnv: 'TEST_FEDERAL_PASSWORD',
      expectedPath: /dashboard\/federal/,
    },
    {
      role: 'k12',
      emailEnv: 'TEST_K12_EMAIL',
      passwordEnv: 'TEST_K12_PASSWORD',
      expectedPath: /dashboard\/k12/,
    },
  ];

  for (const tc of testCases) {
    test(`${tc.role} role lands on correct dashboard`, async ({ page }) => {
      const email = process.env[tc.emailEnv];
      const password = process.env[tc.passwordEnv];
      test.skip(!email || !password, `Requires ${tc.emailEnv} env var`);

      await page.goto('/login');
      await page.getByPlaceholder(/email/i).fill(email!);
      await page.getByPlaceholder(/password/i).fill(password!);
      await page.getByRole('button', { name: /sign in|log in|login/i }).click();
      await page.waitForURL('**/dashboard/**', { timeout: 15000 });
      await expect(page).toHaveURL(tc.expectedPath);
    });
  }
});
