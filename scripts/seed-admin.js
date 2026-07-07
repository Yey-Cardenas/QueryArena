/**
 * Script to create/update the admin user with a freshly generated bcrypt hash.
 * Run with: node scripts/seed-admin.js
 */
require('dotenv').config();
const bcrypt = require('bcrypt');
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // Credentials — override with env vars for production use:
  //   ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_USERNAME
  const username = process.env.ADMIN_USERNAME || 'admin';
  const email    = process.env.ADMIN_EMAIL    || 'admin@queryarena.com';
  const password = process.env.ADMIN_PASSWORD || 'admin123';

  const hash = await bcrypt.hash(password, 10);

  // Verify the hash works before inserting
  const valid = await bcrypt.compare(password, hash);
  if (!valid) {
    console.error('ERROR: Hash verification failed!');
    process.exit(1);
  }

  console.log('Hash generated and verified OK');

  await pool.query(`
    INSERT INTO users (username, email, password_hash, role)
    VALUES ($1, $2, $3, 'admin')
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'admin'
  `, [username, email, hash]);

  console.log('Admin user created/updated successfully');
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);

  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
