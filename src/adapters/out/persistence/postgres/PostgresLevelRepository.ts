/**
 * PostgresLevelRepository.ts
 * PostgreSQL adapter implementing ILevelRepository.
 * Uses the shared `query` helper for all DB access (parameterized queries only).
 */

import type { ILevelRepository } from '../../../../domain/ports/out/ILevelRepository';
import type { Level } from '../../../../domain/entities/Exercise';
import { query } from '../../../../infrastructure/database';

/** Shape of a raw row from the levels table. */
interface LevelRow {
  id: number;
  name: string;
  created_at: Date;
}

function toLevel(row: LevelRow): Level {
  return {
    id: row.id,
    name: row.name,
    created_at: row.created_at,
  };
}

export class PostgresLevelRepository implements ILevelRepository {
  /**
   * Return all difficulty levels ordered by id ascending.
   */
  async findAll(): Promise<Level[]> {
    const result = await query<LevelRow>(
      `SELECT id, name, created_at FROM levels ORDER BY id ASC`,
    );
    return result.rows.map(toLevel);
  }

  /**
   * Find a single level by its unique identifier.
   * Returns null when the level does not exist.
   */
  async findById(id: number): Promise<Level | null> {
    const result = await query<LevelRow>(
      `SELECT id, name, created_at FROM levels WHERE id = $1 LIMIT 1`,
      [id],
    );
    return result.rows.length > 0 ? toLevel(result.rows[0]) : null;
  }

  /**
   * Find a level by its name (case-sensitive).
   * Returns null when no level with that name exists.
   */
  async findByName(name: string): Promise<Level | null> {
    const result = await query<LevelRow>(
      `SELECT id, name, created_at FROM levels WHERE name = $1 LIMIT 1`,
      [name],
    );
    return result.rows.length > 0 ? toLevel(result.rows[0]) : null;
  }

  /**
   * Persist a new level and return the created entity.
   * The DB generates the id (SERIAL) and created_at (DEFAULT NOW()).
   */
  async create(name: string): Promise<Level> {
    const result = await query<LevelRow>(
      `INSERT INTO levels (name) VALUES ($1) RETURNING id, name, created_at`,
      [name],
    );
    return toLevel(result.rows[0]);
  }

  /**
   * Update an existing level's name.
   * Returns the updated entity.
   */
  async update(id: number, name: string): Promise<Level> {
    const result = await query<LevelRow>(
      `UPDATE levels SET name = $1 WHERE id = $2 RETURNING id, name, created_at`,
      [name, id],
    );
    if (result.rows.length === 0) {
      throw new Error(`Level with id ${id} not found`);
    }
    return toLevel(result.rows[0]);
  }

  /**
   * Permanently remove a level by its unique identifier.
   */
  async delete(id: number): Promise<void> {
    await query(`DELETE FROM levels WHERE id = $1`, [id]);
  }
}
