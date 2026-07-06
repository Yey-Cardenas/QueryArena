import { test, expect } from '@playwright/test';

/**
 * E2E tests for client-side form validation on the Register page.
 * These tests do NOT require a running backend — all validation is
 * handled by React before any HTTP request is made (noValidate form).
 *
 * Requirements covered: 15.1, 15.2, 15.3
 */
test.describe('Register page — client-side form validation', () => {
  // Each test navigates fresh to /register
  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
  });

  // ── Requirement 15.1 — Required-field validation ──────────────────────────

  test('shows "Username is required" when username is empty on submit', async ({ page }) => {
    // Requirement 15.1 — username required
    await page.locator('#email').fill('user@example.com');
    await page.locator('#password').fill('validpassword');
    await page.getByRole('button', { name: /register/i }).click();

    await expect(page.getByText('Username is required')).toBeVisible();
  });

  test('shows "Email is required" when email is empty on submit', async ({ page }) => {
    // Requirement 15.1 — email required
    await page.locator('#username').fill('testuser');
    await page.locator('#password').fill('validpassword');
    await page.getByRole('button', { name: /register/i }).click();

    await expect(page.getByText('Email is required')).toBeVisible();
  });

  test('shows "Password is required" when password is empty on submit', async ({ page }) => {
    // Requirement 15.1 — password required
    await page.locator('#username').fill('testuser');
    await page.locator('#email').fill('user@example.com');
    await page.getByRole('button', { name: /register/i }).click();

    await expect(page.getByText('Password is required')).toBeVisible();
  });

  test('shows all three required-field errors when all fields are empty on submit', async ({ page }) => {
    // Requirement 15.1 — all fields required simultaneously
    await page.getByRole('button', { name: /register/i }).click();

    await expect(page.getByText('Username is required')).toBeVisible();
    await expect(page.getByText('Email is required')).toBeVisible();
    await expect(page.getByText('Password is required')).toBeVisible();
  });

  // ── Requirement 15.2 — Email format validation ────────────────────────────

  test('shows "Invalid email format" for a non-email value', async ({ page }) => {
    // Requirement 15.2 — email format
    await page.locator('#username').fill('testuser');
    await page.locator('#email').fill('not-an-email');
    await page.locator('#password').fill('validpassword');
    await page.getByRole('button', { name: /register/i }).click();

    await expect(page.getByText('Invalid email format')).toBeVisible();
  });

  // ── Requirement 15.3 — Password minimum-length validation ────────────────

  test('shows "Password must be at least 8 characters" for a 5-character password', async ({ page }) => {
    // Requirement 15.3 — password min length (well below boundary)
    await page.locator('#username').fill('testuser');
    await page.locator('#email').fill('user@example.com');
    await page.locator('#password').fill('short');   // 5 chars
    await page.getByRole('button', { name: /register/i }).click();

    await expect(page.getByText('Password must be at least 8 characters')).toBeVisible();
  });

  test('shows "Password must be at least 8 characters" for a 7-character password (boundary)', async ({ page }) => {
    // Requirement 15.3 — password min length (boundary: exactly 7 chars)
    await page.locator('#username').fill('testuser');
    await page.locator('#email').fill('user@example.com');
    await page.locator('#password').fill('seven77');   // 7 chars
    await page.getByRole('button', { name: /register/i }).click();

    await expect(page.getByText('Password must be at least 8 characters')).toBeVisible();
  });
});
