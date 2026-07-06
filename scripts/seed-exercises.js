/**
 * Seed script: creates one level, one category, and one exercise for E2E tests.
 * Run with: node scripts/seed-exercises.js
 */
require('dotenv').config();
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // 1. Create level (ignore if exists)
  const levelRes = await pool.query(`
    INSERT INTO levels (name)
    VALUES ('Básico')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
    RETURNING id, name
  `);
  const level = levelRes.rows[0];
  console.log('Level:', level);

  // 2. Create category (ignore if exists)
  const catRes = await pool.query(`
    INSERT INTO categories (name)
    VALUES ('SELECT')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
    RETURNING id, name
  `);
  const category = catRes.rows[0];
  console.log('Category:', category);

  // 3. Create exercise
  const exRes = await pool.query(`
    INSERT INTO exercises (title, description, expected_solution, score, is_active, level_id, category_id)
    VALUES (
      'Seleccionar todos los usuarios',
      'Escribe una consulta SQL que devuelva todos los registros de la tabla users.',
      'SELECT * FROM users',
      10,
      true,
      $1,
      $2
    )
    ON CONFLICT DO NOTHING
    RETURNING id, title
  `, [level.id, category.id]);

  if (exRes.rows.length > 0) {
    console.log('Exercise created:', exRes.rows[0]);
  } else {
    console.log('Exercise already exists, skipping.');
  }

  await pool.end();
  console.log('Seed complete.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
