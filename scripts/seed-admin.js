/**
 * Script to create/update the admin user with a freshly generated bcrypt hash.
 * Run with: node scripts/seed-admin.js
 */
require('dotenv').config();
const bcrypt = require('bcrypt');
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const password = 'admin123';
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
    VALUES ('admin', 'admin@queryarena.com', $1, 'admin')
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'admin'
  `, [hash]);

  console.log('Admin user created/updated successfully');
  console.log('  Email:    admin@queryarena.com');
  console.log('  Password: admin123');

  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
