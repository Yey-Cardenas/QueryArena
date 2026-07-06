/**
 * E2E tests — Complete administrator flow
 *
 * PREREQUISITES (must be running before executing these tests):
 *   1. Backend API server on http://localhost:3000 (npm run dev in the root)
 *   2. Frontend dev server on http://localhost:5173 (started automatically by
 *      playwright.config.ts via the `webServer` option)
 *   3. A database with a seeded admin account (e.g. admin@queryarena.com / admin123)
 *
 * These tests are NOT mocked — they exercise the full stack end-to-end.
 * Run them with:
 *   npx playwright test tests/e2e/admin-flow.spec.ts
 *
 * Requirements covered: 11.1, 12.1, 13.1, 4.1
 */

import { test, expect } from '@playwright/test';

// ─── Admin credentials ────────────────────────────────────────────────────────
// Adjust these to match the seeded admin account in your database.
const ADMIN_EMAIL = 'admin@queryarena.com';
const ADMIN_PASSWORD = 'admin123';

// ─── Student credentials (registered once per test run) ───────────────────────
const timestamp = Date.now();
const student = {
  username: `e2e-admin-flow-student-${timestamp}`,
  email: `e2e-admin-flow-${timestamp}@example.com`,
  password: 'SecurePass123',
};

// ─── Unique names for the resources created in this run ───────────────────────
const levelName = `E2E Level ${timestamp}`;
const categoryName = `E2E Category ${timestamp}`;
const exerciseTitle = `E2E Exercise ${timestamp}`;
const exerciseDescription = `This is an auto-generated exercise created at ${timestamp} by the admin E2E flow test.`;
const exerciseSolution = `SELECT ${timestamp} AS e2e_value`;

// ─── Helper: log in ───────────────────────────────────────────────────────────

async function loginAs(
  page: import('@playwright/test').Page,
  email: string,
  password: string,
  expectedPath: string = '**/dashboard',
) {
  // Limpia cualquier sesión previa del localStorage antes de ir a /login.
  // Los tests seriales comparten el contexto del navegador, por lo que el
  // token del test anterior puede seguir activo y causar que la página de
  // login no se renderice correctamente.
  await page.goto('/login');
  await page.evaluate(() => localStorage.removeItem('qa_token'));

  // Recarga la página para que el AuthContext arranque sin sesión activa
  await page.reload();
  await page.waitForLoadState('domcontentloaded');

  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(expectedPath);
}

// ─── Test suite ───────────────────────────────────────────────────────────────

test.describe('Administrator full flow', () => {
  /**
   * Serial execution: each test builds on the state from the previous one.
   * The admin creates a level, then a category, then an exercise.
   * Finally a student verifies the new exercise is visible in the catalog.
   */
  test.describe.serial('Admin creates resources → student sees them', () => {

    // ── Test 1: Admin login ────────────────────────────────────────────────

    /**
     * Smoke-check that the admin account can log in and reach /dashboard.
     */
    test('1. Admin can sign in', async ({ page }) => {
      await page.goto('/login');

      await page.locator('#email').fill(ADMIN_EMAIL);
      await page.locator('#password').fill(ADMIN_PASSWORD);
      await page.getByRole('button', { name: /sign in/i }).click();

      // Admin lands on /admin/levels after login
      await page.waitForURL('**/admin/levels');
      await expect(page.getByRole('heading', { name: 'Difficulty Levels' })).toBeVisible();
    });

    // ── Test 2: Create a new level (Requirement 11.1) ──────────────────────

    /**
     * Requirement 11.1 — Admin creates a level with a unique valid name.
     * Expected: the level is persisted and appears in the levels table.
     *
     * Steps:
     *   1. Log in as admin
     *   2. Navigate to /admin/levels
     *   3. Click "+ Create level"
     *   4. Fill in the level name and submit
     *   5. Verify the new level appears in the table
     */
    test('2. Admin creates a new difficulty level (Req 11.1)', async ({ page }) => {
      await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD, '**/admin/levels');

      // Navigate to admin levels panel
      await page.goto('/admin/levels');
      await expect(page.getByRole('heading', { name: 'Difficulty Levels' })).toBeVisible();

      // Open create modal
      await page.getByRole('button', { name: /\+ create level/i }).click();

      // Modal dialog must appear
      const modal = page.getByRole('dialog', { name: 'Create level' });
      await expect(modal).toBeVisible();

      // Fill in the level name
      await modal.locator('#level-name').fill(levelName);

      // Submit
      await modal.getByRole('button', { name: /^create$/i }).click();

      // Modal should close
      await expect(modal).not.toBeVisible();

      // The new level must appear in the table (Requirement 11.1)
      const levelsTable = page.getByRole('table', { name: 'Difficulty levels' });
      await expect(levelsTable).toBeVisible();
      await expect(levelsTable.getByText(levelName)).toBeVisible();
    });

    // ── Test 3: Create a new category (Requirement 12.1) ──────────────────

    /**
     * Requirement 12.1 — Admin creates a category with a unique valid name.
     * Expected: the category is persisted and appears in the categories table.
     *
     * Steps:
     *   1. Log in as admin
     *   2. Navigate to /admin/categories
     *   3. Click "Create category"
     *   4. Fill in the category name and submit
     *   5. Verify the new category appears in the table
     */
    test('3. Admin creates a new category (Req 12.1)', async ({ page }) => {
      await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD, '**/admin/levels');

      // Navigate to admin categories panel
      await page.goto('/admin/categories');
      await expect(page.getByRole('heading', { name: 'Categories' })).toBeVisible();

      // Open create modal
      await page.getByRole('button', { name: /create category/i }).click();

      // Modal dialog must appear
      const modal = page.getByRole('dialog', { name: 'Create category' });
      await expect(modal).toBeVisible();

      // Fill in the category name
      await modal.locator('#category-name').fill(categoryName);

      // Submit
      await modal.getByRole('button', { name: /^create$/i }).click();

      // Modal should close
      await expect(modal).not.toBeVisible();

      // The new category must appear in the table (Requirement 12.1)
      const categoriesTable = page.getByRole('table', { name: 'Categories table' });
      await expect(categoriesTable).toBeVisible();
      await expect(categoriesTable.getByText(categoryName)).toBeVisible();
    });

    // ── Test 4: Create a new exercise (Requirement 13.1) ──────────────────

    /**
     * Requirement 13.1 — Admin creates an exercise with all required fields.
     * Expected: the exercise is persisted and appears in the exercises table.
     *
     * Steps:
     *   1. Log in as admin
     *   2. Navigate to /admin/exercises
     *   3. Click "+ Create exercise"
     *   4. Fill in title, description, expected SQL solution, score, level, category
     *   5. Submit
     *   6. Verify the new exercise appears in the exercises table
     */
    test('4. Admin creates a new exercise using the new level and category (Req 13.1)', async ({ page }) => {
      await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD, '**/admin/levels');

      // Navigate to admin exercises panel
      await page.goto('/admin/exercises');
      await expect(page.getByRole('heading', { name: 'Exercises' })).toBeVisible();

      // Open create modal
      await page.getByRole('button', { name: /\+ create exercise/i }).click();

      // Modal dialog must appear
      const modal = page.getByRole('dialog', { name: 'Create exercise' });
      await expect(modal).toBeVisible();

      // Wait for the level and category selects to be populated from the API
      // before trying to select options (they load asynchronously)
      await expect(modal.locator('#ex-level option', { hasText: levelName })).toBeAttached({ timeout: 10000 });
      await expect(modal.locator('#ex-category option', { hasText: categoryName })).toBeAttached({ timeout: 10000 });

      // Fill in all required fields
      await modal.locator('#ex-title').fill(exerciseTitle);
      await modal.locator('#ex-description').fill(exerciseDescription);
      await modal.locator('#ex-solution').fill(exerciseSolution);
      await modal.locator('#ex-score').fill('15');

      // Select the level created in test 2
      await modal.locator('#ex-level').selectOption({ label: levelName });

      // Select the category created in test 3
      await modal.locator('#ex-category').selectOption({ label: categoryName });

      // Submit
      await modal.getByRole('button', { name: /^create$/i }).click();

      // Modal should close
      await expect(modal).not.toBeVisible();

      // The new exercise must appear in the exercises table (Requirement 13.1)
      const exercisesTable = page.getByRole('table', { name: 'Exercises table' });
      await expect(exercisesTable).toBeVisible();
      await expect(exercisesTable.getByText(exerciseTitle)).toBeVisible();

      // Verify the level and category names are displayed in the row
      const exerciseRow = exercisesTable.locator('tr').filter({ hasText: exerciseTitle });
      await expect(exerciseRow.getByText(levelName)).toBeVisible();
      await expect(exerciseRow.getByText(categoryName)).toBeVisible();
    });

    // ── Test 5: Register a student ─────────────────────────────────────────

    /**
     * Register a fresh student account so we can verify the exercise catalog
     * as a non-admin user (Requirement 4.1).
     */
    test('5. Register a student account for catalog verification', async ({ page }) => {
      await page.goto('/register');

      await page.locator('#username').fill(student.username);
      await page.locator('#email').fill(student.email);
      await page.locator('#password').fill(student.password);
      await page.getByRole('button', { name: /register/i }).click();

      await page.waitForURL('**/login');
      await expect(
        page.getByText('Account created successfully. Please sign in.')
      ).toBeVisible();
    });

    // ── Test 6: Student sees the new exercise in the catalog (Req 4.1) ─────

    /**
     * Requirement 4.1 — A student requests the exercise catalog and the newly
     * created exercise (active by default) is visible.
     *
     * Steps:
     *   1. Log in as the student registered in test 5
     *   2. Navigate to /exercises
     *   3. Verify the exercise catalog renders
     *   4. Verify the exercise created in test 4 appears in the list
     */
    test('6. Student can see the new exercise in the catalog (Req 4.1)', async ({ page }) => {
      await loginAs(page, student.email, student.password);

      // Navigate to the exercise catalog
      await page.goto('/exercises');
      await expect(page.getByRole('heading', { name: 'Exercises' })).toBeVisible();

      // Wait for the catalog list to be rendered
      const catalog = page.getByRole('list', { name: 'Exercise catalog' });
      await expect(catalog).toBeVisible({ timeout: 10000 });

      // The exercise created by the admin (test 4) must appear in the catalog.
      // Exercises are shown as buttons with aria-label "Open exercise: {title}"
      await expect(
        catalog.getByRole('button', { name: `Open exercise: ${exerciseTitle}` })
      ).toBeVisible({ timeout: 10000 });
    });
  });
});
