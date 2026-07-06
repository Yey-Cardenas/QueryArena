/**
 * PostgresUserRepository.ts
 * Implements IUserRepository using PostgreSQL via the shared `query` helper.
 * All queries are parameterised — no string interpolation of user-supplied values.
 */

import type { User, UserRole } from '../../../../domain/entities/User';
import type { IUserRepository } from '../../../../domain/ports/out/IUserRepository';
import { query } from '../../../../infrastructure/database';
import { toUser, type UserRow } from './user.mapper';

export class PostgresUserRepository implements IUserRepository {
  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  async findByEmail(email: string): Promise<User | null> {
    const result = await query<UserRow>(
      `SELECT id, username, email, password_hash, role, is_active, created_at, updated_at
         FROM users
        WHERE email = $1
        LIMIT 1`,
      [email],
    );

    return result.rows.length > 0 ? toUser(result.rows[0]) : null;
  }

  async findByUsername(username: string): Promise<User | null> {
    const result = await query<UserRow>(
      `SELECT id, username, email, password_hash, role, is_active, created_at, updated_at
         FROM users
        WHERE username = $1
        LIMIT 1`,
      [username],
    );

    return result.rows.length > 0 ? toUser(result.rows[0]) : null;
  }

  async findById(id: string): Promise<User | null> {
    const result = await query<UserRow>(
      `SELECT id, username, email, password_hash, role, is_active, created_at, updated_at
         FROM users
        WHERE id = $1
        LIMIT 1`,
      [id],
    );

    return result.rows.length > 0 ? toUser(result.rows[0]) : null;
  }

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  async create(data: {
    username: string;
    email: string;
    password_hash: string;
    role: UserRole;
  }): Promise<User> {
    const result = await query<UserRow>(
      `INSERT INTO users (username, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, email, password_hash, role, is_active, created_at, updated_at`,
      [data.username, data.email, data.password_hash, data.role],
    );

    return toUser(result.rows[0]);
  }

  async update(
    id: string,
    data: { username?: string; email?: string },
  ): Promise<User> {
    // COALESCE keeps the existing value when the caller does not supply a new one.
    const result = await query<UserRow>(
      `UPDATE users
          SET username   = COALESCE($2, username),
              email      = COALESCE($3, email),
              updated_at = NOW()
        WHERE id = $1
        RETURNING id, username, email, password_hash, role, is_active, created_at, updated_at`,
      [id, data.username ?? null, data.email ?? null],
    );

    if (result.rows.length === 0) {
      throw new Error(`User with id "${id}" not found`);
    }

    return toUser(result.rows[0]);
  }
}
