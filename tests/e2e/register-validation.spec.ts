import { test, expect } from '@playwright/test';

/**
 * E2E tests — Validación del formulario de registro (lado del cliente).
 * No requieren backend en ejecución: toda la validación ocurre en React
 * antes de hacer ninguna petición HTTP (formulario noValidate).
 *
 * Requisitos cubiertos: 15.1, 15.2, 15.3
 */
test.describe('Register page — client-side form validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
  });

  // ── Req 15.1 — Campos obligatorios ────────────────────────────────────────

  test('shows "El nombre de usuario es requerido" when username is empty on submit', async ({ page }) => {
    await page.locator('#email').fill('user@example.com');
    await page.locator('#password').fill('validpassword');
    await page.getByRole('button', { name: /registrarse/i }).click();

    await expect(page.getByText('El nombre de usuario es requerido')).toBeVisible();
  });

  test('shows "El correo electrónico es requerido" when email is empty on submit', async ({ page }) => {
    await page.locator('#username').fill('testuser');
    await page.locator('#password').fill('validpassword');
    await page.getByRole('button', { name: /registrarse/i }).click();

    await expect(page.getByText('El correo electrónico es requerido')).toBeVisible();
  });

  test('shows "La contraseña es requerida" when password is empty on submit', async ({ page }) => {
    await page.locator('#username').fill('testuser');
    await page.locator('#email').fill('user@example.com');
    await page.getByRole('button', { name: /registrarse/i }).click();

    await expect(page.getByText('La contraseña es requerida')).toBeVisible();
  });

  test('shows all three required-field errors when all fields are empty on submit', async ({ page }) => {
    await page.getByRole('button', { name: /registrarse/i }).click();

    await expect(page.getByText('El nombre de usuario es requerido')).toBeVisible();
    await expect(page.getByText('El correo electrónico es requerido')).toBeVisible();
    await expect(page.getByText('La contraseña es requerida')).toBeVisible();
  });

  // ── Req 15.2 — Formato de correo ──────────────────────────────────────────

  test('shows "Formato de correo inválido" for a non-email value', async ({ page }) => {
    await page.locator('#username').fill('testuser');
    await page.locator('#email').fill('no-es-un-email');
    await page.locator('#password').fill('validpassword');
    await page.getByRole('button', { name: /registrarse/i }).click();

    await expect(page.getByText('Formato de correo inválido')).toBeVisible();
  });

  // ── Req 15.3 — Longitud mínima de contraseña ──────────────────────────────

  test('shows "La contraseña debe tener al menos 8 caracteres" for a 5-character password', async ({ page }) => {
    await page.locator('#username').fill('testuser');
    await page.locator('#email').fill('user@example.com');
    await page.locator('#password').fill('short');   // 5 chars
    await page.getByRole('button', { name: /registrarse/i }).click();

    await expect(page.getByText('La contraseña debe tener al menos 8 caracteres')).toBeVisible();
  });

  test('shows "La contraseña debe tener al menos 8 caracteres" for a 7-character password (boundary)', async ({ page }) => {
    await page.locator('#username').fill('testuser');
    await page.locator('#email').fill('user@example.com');
    await page.locator('#password').fill('seven77');   // 7 chars
    await page.getByRole('button', { name: /registrarse/i }).click();

    await expect(page.getByText('La contraseña debe tener al menos 8 caracteres')).toBeVisible();
  });
});
