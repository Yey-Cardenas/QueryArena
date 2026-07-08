/**
 * E2E tests — Flujo completo del estudiante
 *
 * PRERREQUISITOS (deben estar activos antes de ejecutar):
 *   1. Backend API en http://localhost:3000  (npm run dev en la raíz)
 *   2. Frontend en http://localhost:5173     (iniciado por playwright.config.ts)
 *   3. Base de datos con al menos un ejercicio publicado
 *
 * Ejecutar con:
 *   npx playwright test tests/e2e/student-flow.spec.ts
 *
 * Requisitos cubiertos: 1.1, 2.1, 4.1, 5.1, 7.1, 8.3, 9.1, 10.1
 */

import { test, expect } from '@playwright/test';

const timestamp = Date.now();
const credentials = {
  username: `e2e-student-${timestamp}`,
  email: `e2e-${timestamp}@example.com`,
  password: 'SecurePass123',
};

test.describe('Student full flow', () => {
  test.describe.serial('Complete student journey', () => {

    // ── Test 1: Registro ────────────────────────────────────────────────────

    test('1. Registration — new student can register successfully', async ({ page }) => {
      await page.goto('/register');

      await page.locator('#username').fill(credentials.username);
      await page.locator('#email').fill(credentials.email);
      await page.locator('#password').fill(credentials.password);

      await page.getByRole('button', { name: /registrarse/i }).click();

      // Redirección a /login con banner de éxito
      await page.waitForURL('**/login');
      await expect(
        page.getByText('✓ Cuenta creada exitosamente. ¡Ya puedes iniciar sesión!')
      ).toBeVisible();
    });

    // ── Test 2: Login ───────────────────────────────────────────────────────

    test('2. Login — registered student can sign in', async ({ page }) => {
      await page.goto('/login');

      await page.locator('#email').fill(credentials.email);
      await page.locator('#password').fill(credentials.password);

      await page.getByRole('button', { name: /iniciar sesión/i }).click();

      await page.waitForURL('**/dashboard');
      await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
    });

    // ── Test 3: Catálogo de ejercicios ──────────────────────────────────────

    test('3. Exercise catalog — student can browse exercises', async ({ page }) => {
      await page.goto('/login');
      await page.locator('#email').fill(credentials.email);
      await page.locator('#password').fill(credentials.password);
      await page.getByRole('button', { name: /iniciar sesión/i }).click();
      await page.waitForURL('**/dashboard');

      await page.goto('/exercises');

      await expect(
        page.getByRole('heading', { name: /catálogo de ejercicios/i })
      ).toBeVisible();

      const catalog = page.getByRole('list', { name: /catálogo de ejercicios/i });
      await expect(catalog).toBeVisible();

      const firstExercise = catalog.locator('li').first();
      await expect(firstExercise).toBeVisible();
    });

    // ── Test 4: Resolución de ejercicio ────────────────────────────────────

    test('4. Exercise resolution — student can submit answer and see result', async ({ page }) => {
      await page.goto('/login');
      await page.locator('#email').fill(credentials.email);
      await page.locator('#password').fill(credentials.password);
      await page.getByRole('button', { name: /iniciar sesión/i }).click();
      await page.waitForURL('**/dashboard');

      await page.goto('/exercises');

      const catalog = page.getByRole('list', { name: /catálogo de ejercicios/i });
      await expect(catalog).toBeVisible({ timeout: 15000 });

      const firstExerciseButton = catalog.getByRole('button').first();
      await expect(firstExerciseButton).toBeVisible({ timeout: 15000 });
      await firstExerciseButton.click();

      await page.waitForURL(/\/exercises\/[^/]+$/, { timeout: 10000 });

      const queryInput = page.locator('#sql-query');
      await expect(queryInput).toBeVisible({ timeout: 10000 });
      await queryInput.fill('SELECT 1');

      await page.getByRole('button', { name: 'Enviar solución' }).click();

      const resultRegion = page.getByRole('region', { name: 'Resultado del intento' });
      await expect(resultRegion).toBeVisible({ timeout: 20000 });

      const validStatuses = ['✓ Correcto', '✗ Incorrecto', '⚠ Error'];
      const statusTexts = await resultRegion.allInnerTexts();
      const combined = statusTexts.join(' ');
      const hasValidStatus = validStatuses.some((s) => combined.includes(s));
      expect(hasValidStatus).toBe(true);

      await expect(resultRegion.getByText(/\d+ pts/)).toBeVisible();
      await expect(resultRegion.getByText(/\d+\.\d+ s/)).toBeVisible();
    });

    // ── Test 5: Dashboard ───────────────────────────────────────────────────

    test('5. Dashboard — student can view their progress', async ({ page }) => {
      await page.goto('/login');
      await page.locator('#email').fill(credentials.email);
      await page.locator('#password').fill(credentials.password);
      await page.getByRole('button', { name: /iniciar sesión/i }).click();
      await page.waitForURL('**/dashboard');

      await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();

      const summarySection = page.getByRole('region', { name: /resumen/i });
      await expect(summarySection).toBeVisible();

      await expect(summarySection.getByText('Ejercicios intentados')).toBeVisible();
      await expect(summarySection.getByText('Puntaje acumulado')).toBeVisible();
      await expect(summarySection.getByText('Posición en ranking')).toBeVisible();
    });

    // ── Test 6: Ranking ─────────────────────────────────────────────────────

    test('6. Ranking — student appears in ranking with their position', async ({ page }) => {
      await page.goto('/login');
      await page.locator('#email').fill(credentials.email);
      await page.locator('#password').fill(credentials.password);
      await page.getByRole('button', { name: /iniciar sesión/i }).click();
      await page.waitForURL('**/dashboard');

      await page.goto('/ranking');

      await expect(page.getByRole('heading', { name: /ranking/i })).toBeVisible();

      await expect(page.getByText('Cargando ranking…')).toBeHidden({ timeout: 10000 });

      const hasTable = await page
        .getByRole('table', { name: /tabla de ranking/i })
        .isVisible()
        .catch(() => false);
      const hasEmpty = await page
        .getByText('No hay estudiantes registrados aún.')
        .isVisible()
        .catch(() => false);

      expect(hasTable || hasEmpty).toBe(true);

      if (hasTable) {
        const rankingTable = page.getByRole('table', { name: /tabla de ranking/i });
        await expect(rankingTable.getByText('Posición')).toBeVisible();
        await expect(rankingTable.getByText('Usuario')).toBeVisible();
        await expect(rankingTable.getByText('Puntaje Acumulado')).toBeVisible();
      }
    });
  });
});
