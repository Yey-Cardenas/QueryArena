/**
 * user.mapper.ts
 * Maps a raw PostgreSQL row from the `users` table to a User domain entity.
 * No business logic — pure structural transformation.
 */

import type { User, UserRole } from '../../../../domain/entities/User';

/**
 * Shape of a raw row returned by postgres-node (pg) from the `users` table.
 * Column names match the SQL schema exactly (snake_case).
 */
export interface UserRow {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  role: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * Convert a raw DB row to a User domain entity.
 * Throws if the role value is not a recognised UserRole.
 */
export function toUser(row: UserRow): User {
  const role = row.role as UserRole;
  if (role !== 'student' && role !== 'admin') {
    throw new Error(`Unknown user role stored in DB: "${row.role}"`);
  }

  return {
    id: row.id,
    username: row.username,
    email: row.email,
    password_hash: row.password_hash,
    role,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
