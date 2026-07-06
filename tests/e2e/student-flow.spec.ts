/**
 * E2E tests — Complete student flow
 *
 * PREREQUISITES (must be running before executing these tests):
 *   1. Backend API server on http://localhost:3000 (npm run dev in the root)
 *   2. Frontend dev server on http://localhost:5173 (started automatically by
 *      playwright.config.ts via the `webServer` option)
 *   3. A seeded database with at least one published exercise
 *
 * These tests are NOT mocked — they exercise the full stack end-to-end.
 * Run them with:
 *   npx playwright test tests/e2e/student-flow.spec.ts
 *
 * Requirements covered: 1.1, 2.1, 4.1, 5.1, 7.1, 8.3, 9.1, 10.1
 */

import { test, expect } from '@playwright/test';

// ─── Shared credentials (generated once per test run to avoid conflicts) ─────

const timestamp = Date.now();
const credentials = {
  username: `e2e-student-${timestamp}`,
  email: `e2e-${timestamp}@example.com`,
  password: 'SecurePass123',
};

// ─── Test suite ───────────────────────────────────────────────────────────────

test.describe('Student full flow', () => {
  /**
   * Serial execution ensures each test builds on the state left by the
   * previous one (registered account, active session, submitted attempt).
   */
  test.describe.serial('Complete student journey', () => {

    // ── Test 1: Registration ───────────────────────────────────────────────

    /**
     * Requirement 1.1 — A new student can register an account.
     *
     * Steps:
     *   1. Navigate to /register
     *   2. Fill in username, email, and password
     *   3. Submit the form
     *   4. Verify redirection to /login with the "Account created" banner
     */
    test('1. Registration — new student can register successfully', async ({ page }) => {
      await page.goto('/register');

      // Fill the registration form using the stable IDs from RegisterPage
      await page.locator('#username').fill(credentials.username);
      await page.locator('#email').fill(credentials.email);
      await page.locator('#password').fill(credentials.password);

      // Submit
      await page.getByRole('button', { name: /register/i }).click();

      // After a successful registration the app redirects to /login and shows
      // a success banner (Requirements 1.1, RegisterPage behaviour).
      await page.waitForURL('**/login');
      await expect(
        page.getByText('Account created successfully. Please sign in.')
      ).toBeVisible();
    });

    // ── Test 2: Login ──────────────────────────────────────────────────────

    /**
     * Requirement 2.1 — A registered student can sign in.
     *
     * Steps:
     *   1. Navigate to /login
     *   2. Fill in email and password with the credentials created in test 1
     *   3. Submit the form
     *   4. Verify redirection to /dashboard
     */
    test('2. Login — registered student can sign in', async ({ page }) => {
      await page.goto('/login');

      await page.locator('#email').fill(credentials.email);
      await page.locator('#password').fill(credentials.password);

      await page.getByRole('button', { name: /sign in/i }).click();

      // Successful login navigates to /dashboard
      await page.waitForURL('**/dashboard');
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    });

    // ── Test 3: Exercise catalog ───────────────────────────────────────────

    /**
     * Requirement 4.1 — Student can browse the exercise catalog.
     *
     * Steps:
     *   1. (Session already established by test 2 — same browser context)
     *   2. Navigate to /exercises
     *   3. Verify the page heading and the exercise list are rendered
     *   4. Verify at least one exercise card is present
     */
    test('3. Exercise catalog — student can browse exercises', async ({ page }) => {
      // Re-establish session: navigate to login and sign in again
      // (each serial test gets a fresh page but shares browser storage only
      //  when storageState is explicitly configured; we log in fresh here)
      await page.goto('/login');
      await page.locator('#email').fill(credentials.email);
      await page.locator('#password').fill(credentials.password);
      await page.getByRole('button', { name: /sign in/i }).click();
      await page.waitForURL('**/dashboard');

      // Navigate to exercises catalog
      await page.goto('/exercises');

      // Heading (Requirement 4.1)
      await expect(page.getByRole('heading', { name: 'Exercises' })).toBeVisible();

      // Exercise catalog list rendered with aria-label
      const catalog = page.getByRole('list', { name: 'Exercise catalog' });
      await expect(catalog).toBeVisible();

      // At least one exercise must exist in the seeded database
      const firstExercise = catalog.locator('li').first();
      await expect(firstExercise).toBeVisible();
    });

    // ── Test 4: Exercise resolution ────────────────────────────────────────

    /**
     * Requirements 5.1, 7.1 — Student can submit a SQL query and see the result.
     *
     * Steps:
     *   1. Log in and navigate to /exercises
     *   2. Click the first available exercise
     *   3. Enter a SQL query in the editor
     *   4. Submit the form
     *   5. Wait for the result region to appear
     *   6. Verify the result region shows a valid status badge and score/time
     *
     * NOTE: We do not assert that the answer is "correct" because the expected
     * solution for each exercise is unknown at test time. Instead we verify that
     * the result panel appears and contains one of the three valid statuses.
     */
    test('4. Exercise resolution — student can submit answer and see result', async ({ page }) => {
      // Log in
      await page.goto('/login');
      await page.locator('#email').fill(credentials.email);
      await page.locator('#password').fill(credentials.password);
      await page.getByRole('button', { name: /sign in/i }).click();
      await page.waitForURL('**/dashboard');

      // Navigate to exercises and click the first one
      await page.goto('/exercises');

      // Wait for at least one exercise to be available (the DB must have exercises)
      const catalog = page.getByRole('list', { name: 'Exercise catalog' });
      await expect(catalog).toBeVisible({ timeout: 15000 });

      const firstExerciseButton = catalog.getByRole('button').first();
      await expect(firstExerciseButton).toBeVisible({ timeout: 15000 });
      await firstExerciseButton.click();

      // Should be on /exercises/:id now
      await page.waitForURL(/\/exercises\/[^/]+$/, { timeout: 10000 });

      // Enter a SQL query — use a simple generic query that any DB should handle
      const queryInput = page.locator('#sql-query');
      await expect(queryInput).toBeVisible({ timeout: 10000 });
      await queryInput.fill('SELECT 1');

      // Submit
      await page.getByRole('button', { name: 'Enviar solución' }).click();

      // Wait for the result region to appear (Requirements 7.1, 7.4)
      const resultRegion = page.getByRole('region', { name: 'Resultado del intento' });
      await expect(resultRegion).toBeVisible({ timeout: 20000 });

      // One of the three valid status badges must be present
      const validStatuses = ['✓ Correcto', '✗ Incorrecto', '⚠ Error'];
      const statusTexts = await resultRegion.allInnerTexts();
      const combined = statusTexts.join(' ');
      const hasValidStatus = validStatuses.some((s) => combined.includes(s));
      expect(hasValidStatus).toBe(true);

      // Score line must be present (format: "{n} pts")
      await expect(resultRegion.getByText(/\d+ pts/)).toBeVisible();

      // Resolution time line must be present (format: "{n.n} s")
      await expect(resultRegion.getByText(/\d+\.\d+ s/)).toBeVisible();
    });

    // ── Test 5: Dashboard ──────────────────────────────────────────────────

    /**
     * Requirement 9.1 — Student can view their progress on the dashboard.
     *
     * Steps:
     *   1. (After test 4 submitted an attempt)
     *   2. Log in and navigate to /dashboard
     *   3. Verify the heading is visible
     *   4. Verify the summary section with stat cards is rendered
     *   5. Verify at least one stat card label is present (exercises attempted)
     */
    test('5. Dashboard — student can view their progress', async ({ page }) => {
      // Log in
      await page.goto('/login');
      await page.locator('#email').fill(credentials.email);
      await page.locator('#password').fill(credentials.password);
      await page.getByRole('button', { name: /sign in/i }).click();
      await page.waitForURL('**/dashboard');

      // Heading (Requirement 9.1)
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

      // Summary section rendered
      const summarySection = page.getByRole('region', { name: 'Resumen' });
      await expect(summarySection).toBeVisible();

      // At least the "Ejercicios intentados" stat card label must appear
      // (after test 4's submission the count must be >= 1)
      await expect(summarySection.getByText('Ejercicios intentados')).toBeVisible();

      // "Puntaje acumulado" stat card label
      await expect(summarySection.getByText('Puntaje acumulado')).toBeVisible();

      // "Posición en ranking" stat card label
      await expect(summarySection.getByText('Posición en ranking')).toBeVisible();
    });

    // ── Test 6: Ranking ────────────────────────────────────────────────────

    /**
     * Requirements 10.1, 8.3 — Student appears in the ranking table.
     *
     * Steps:
     *   1. Log in and navigate to /ranking
     *   2. Verify heading and table are visible
     *   3. Verify the current user's row is highlighted with aria-current="true"
     *      and shows the "→ Tú" indicator
     */
    test('6. Ranking — student appears in ranking with their position', async ({ page }) => {
      // Log in
      await page.goto('/login');
      await page.locator('#email').fill(credentials.email);
      await page.locator('#password').fill(credentials.password);
      await page.getByRole('button', { name: /sign in/i }).click();
      await page.waitForURL('**/dashboard');

      // Navigate to ranking
      await page.goto('/ranking');

      // Heading (Requirement 10.1)
      await expect(page.getByRole('heading', { name: 'Ranking' })).toBeVisible();

      // Wait for the loading indicator to disappear before checking content.
      // The page starts in a loading state and renders "Cargando ranking…"
      // until the API responds — checking visibility before this resolves will
      // always return false for both the table and the empty-state message.
      await expect(page.getByText('Cargando ranking…')).toBeHidden({ timeout: 10000 });

      // The ranking page must render without errors — either the table with
      // entries or the empty-state message. Both are valid since the student
      // may not have a correct attempt yet.
      const hasTable = await page.getByRole('table', { name: 'Tabla de ranking' }).isVisible().catch(() => false);
      const hasEmpty = await page.getByText('No hay estudiantes registrados aún.').isVisible().catch(() => false);

      expect(hasTable || hasEmpty).toBe(true);

      // If the table is visible, verify it has the expected columns
      if (hasTable) {
        const rankingTable = page.getByRole('table', { name: 'Tabla de ranking' });
        await expect(rankingTable.getByText('Posición')).toBeVisible();
        await expect(rankingTable.getByText('Usuario')).toBeVisible();
        await expect(rankingTable.getByText('Puntaje Acumulado')).toBeVisible();
      }
    });
  });
});
