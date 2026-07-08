/**
 * E2E tests — Flujo completo del administrador
 *
 * PRERREQUISITOS:
 *   1. Backend API en http://localhost:3000  (npm run dev en la raíz)
 *   2. Frontend en http://localhost:5173     (iniciado por playwright.config.ts)
 *   3. Base de datos con cuenta admin creada (p. ej. admin@queryarena.com / admin123)
 *
 * Ejecutar con:
 *   npx playwright test tests/e2e/admin-flow.spec.ts
 *
 * Requisitos cubiertos: 11.1, 12.1, 13.1, 4.1
 */

import { test, expect } from '@playwright/test';

// ─── Credenciales admin ───────────────────────────────────────────────────────
const ADMIN_EMAIL    = 'admin@queryarena.com';
const ADMIN_PASSWORD = 'admin123';

// ─── Credenciales estudiante (se registra una vez por ejecución) ─────────────
const timestamp = Date.now();
const student = {
  username: `e2e-admin-flow-student-${timestamp}`,
  email:    `e2e-admin-flow-${timestamp}@example.com`,
  password: 'SecurePass123',
};

// ─── Nombres únicos para los recursos creados en esta ejecución ──────────────
const levelName           = `E2E Level ${timestamp}`;
const categoryName        = `E2E Category ${timestamp}`;
const exerciseTitle       = `E2E Exercise ${timestamp}`;
const exerciseDescription = `Ejercicio generado en ${timestamp} por el test E2E de flujo admin.`;
const exerciseSolution    = `SELECT ${timestamp} AS e2e_value`;

// ─── Helper: iniciar sesión ──────────────────────────────────────────────────

async function loginAs(
  page: import('@playwright/test').Page,
  email: string,
  password: string,
  expectedPath = '**/dashboard',
) {
  await page.goto('/login');
  // Limpiar sesión previa para evitar conflictos entre tests seriales
  await page.evaluate(() => {
    try { localStorage.removeItem('qa_token'); } catch { /* ignorar */ }
  });
  await page.reload();
  await page.waitForLoadState('domcontentloaded');

  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /iniciar sesión/i }).click();
  await page.waitForURL(expectedPath);
}

// ─── Test suite ───────────────────────────────────────────────────────────────

test.describe('Administrator full flow', () => {
  test.describe.serial('Admin creates resources → student sees them', () => {

    // ── Test 1: Login admin ────────────────────────────────────────────────
    // Heading real: "🎯 Niveles de Dificultad"
    // Botón crear: "+ Crear nivel"

    test('1. Admin can sign in', async ({ page }) => {
      await page.goto('/login');
      await page.locator('#email').fill(ADMIN_EMAIL);
      await page.locator('#password').fill(ADMIN_PASSWORD);
      await page.getByRole('button', { name: /iniciar sesión/i }).click();

      // El admin aterriza en /admin/levels tras iniciar sesión
      await page.waitForURL('**/admin/levels');
      await expect(
        page.getByRole('heading', { name: /niveles de dificultad/i })
      ).toBeVisible();
    });

    // ── Test 2: Crear nivel (Req 11.1) ─────────────────────────────────────
    // Heading: "🎯 Niveles de Dificultad"
    // Botón: "+ Crear nivel"
    // Modal aria-label: "Crear nivel"
    // Input id: "level-name"
    // Botón submit: "Crear"
    // Table aria-label: "Niveles de dificultad"

    test('2. Admin creates a new difficulty level (Req 11.1)', async ({ page }) => {
      await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD, '**/admin/levels');

      await page.goto('/admin/levels');
      await expect(
        page.getByRole('heading', { name: /niveles de dificultad/i })
      ).toBeVisible();

      await page.getByRole('button', { name: '+ Crear nivel' }).click();

      const modal = page.getByRole('dialog', { name: 'Crear nivel' });
      await expect(modal).toBeVisible();

      await modal.locator('#level-name').fill(levelName);
      await modal.getByRole('button', { name: 'Crear' }).click();

      await expect(modal).not.toBeVisible();

      const levelsTable = page.getByRole('table', { name: 'Niveles de dificultad' });
      await expect(levelsTable).toBeVisible();
      await expect(levelsTable.getByText(levelName)).toBeVisible();
    });

    // ── Test 3: Crear categoría (Req 12.1) ────────────────────────────────
    // Heading: "🏷️ Categorías"
    // Botón: "+ Crear categoría"
    // Modal aria-label: "Crear categoría"
    // Input id: "category-name"
    // Botón submit: "Crear"
    // Table aria-label: "Tabla de categorías"

    test('3. Admin creates a new category (Req 12.1)', async ({ page }) => {
      await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD, '**/admin/levels');

      await page.goto('/admin/categories');
      await expect(
        page.getByRole('heading', { name: /categorías/i })
      ).toBeVisible();

      await page.getByRole('button', { name: '+ Crear categoría' }).click();

      const modal = page.getByRole('dialog', { name: 'Crear categoría' });
      await expect(modal).toBeVisible();

      await modal.locator('#category-name').fill(categoryName);
      await modal.getByRole('button', { name: 'Crear' }).click();

      await expect(modal).not.toBeVisible();

      const categoriesTable = page.getByRole('table', { name: 'Tabla de categorías' });
      await expect(categoriesTable).toBeVisible();
      await expect(categoriesTable.getByText(categoryName)).toBeVisible();
    });

    // ── Test 4: Crear ejercicio (Req 13.1) ────────────────────────────────
    // Heading: "📝 Ejercicios"
    // Botón: "+ Crear ejercicio"
    // Modal aria-label: "Crear ejercicio"
    // Inputs: #ex-title, #ex-description, #ex-solution, #ex-score, #ex-level, #ex-category
    // Botón submit: "Crear"
    // Table aria-label: "Tabla de ejercicios"

    test('4. Admin creates a new exercise using the new level and category (Req 13.1)', async ({ page }) => {
      await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD, '**/admin/levels');

      await page.goto('/admin/exercises');
      await expect(
        page.getByRole('heading', { name: /ejercicios/i })
      ).toBeVisible();

      await page.getByRole('button', { name: '+ Crear ejercicio' }).click();

      const modal = page.getByRole('dialog', { name: 'Crear ejercicio' });
      await expect(modal).toBeVisible();

      // Esperar que los selects carguen desde la API
      await expect(
        modal.locator('#ex-level option', { hasText: levelName })
      ).toBeAttached({ timeout: 10000 });
      await expect(
        modal.locator('#ex-category option', { hasText: categoryName })
      ).toBeAttached({ timeout: 10000 });

      await modal.locator('#ex-title').fill(exerciseTitle);
      await modal.locator('#ex-description').fill(exerciseDescription);
      await modal.locator('#ex-solution').fill(exerciseSolution);
      await modal.locator('#ex-score').fill('15');
      await modal.locator('#ex-level').selectOption({ label: levelName });
      await modal.locator('#ex-category').selectOption({ label: categoryName });

      await modal.getByRole('button', { name: 'Crear' }).click();

      await expect(modal).not.toBeVisible();

      const exercisesTable = page.getByRole('table', { name: 'Tabla de ejercicios' });
      await expect(exercisesTable).toBeVisible();
      await expect(exercisesTable.getByText(exerciseTitle)).toBeVisible();

      const exerciseRow = exercisesTable.locator('tr').filter({ hasText: exerciseTitle });
      await expect(exerciseRow.getByText(levelName)).toBeVisible();
      await expect(exerciseRow.getByText(categoryName)).toBeVisible();
    });

    // ── Test 5: Registrar estudiante para verificación ────────────────────
    // Botón: "Registrarse"
    // Banner éxito (LoginPage): "✓ Cuenta creada exitosamente. ¡Ya puedes iniciar sesión!"

    test('5. Register a student account for catalog verification', async ({ page }) => {
      await page.goto('/register');

      await page.locator('#username').fill(student.username);
      await page.locator('#email').fill(student.email);
      await page.locator('#password').fill(student.password);
      await page.getByRole('button', { name: /registrarse/i }).click();

      await page.waitForURL('**/login');
      await expect(
        page.getByText('✓ Cuenta creada exitosamente. ¡Ya puedes iniciar sesión!')
      ).toBeVisible();
    });

    // ── Test 6: Estudiante ve el nuevo ejercicio (Req 4.1) ────────────────
    // Heading: "📚 Catálogo de Ejercicios"
    // Lista aria-label: "Catálogo de ejercicios"
    // Botón aria-label: "Abrir ejercicio: {título}"

    test('6. Student can see the new exercise in the catalog (Req 4.1)', async ({ page }) => {
      await loginAs(page, student.email, student.password);

      await page.goto('/exercises');
      await expect(
        page.getByRole('heading', { name: /catálogo de ejercicios/i })
      ).toBeVisible();

      const catalog = page.getByRole('list', { name: /catálogo de ejercicios/i });
      await expect(catalog).toBeVisible({ timeout: 10000 });

      await expect(
        catalog.getByRole('button', { name: `Abrir ejercicio: ${exerciseTitle}` })
      ).toBeVisible({ timeout: 10000 });
    });
  });
});
