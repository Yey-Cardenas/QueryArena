/**
 * PostgresCategoryRepository.ts
 * PostgreSQL adapter implementing ICategoryRepository.
 * Uses the shared `query` helper for all DB access (parameterized queries only).
 */

import type { ICategoryRepository } from '../../../../domain/ports/out/ICategoryRepository';
import type { Category } from '../../../../domain/entities/Exercise';
import { query } from '../../../../infrastructure/database';

/** Shape of a raw row from the categories table. */
interface CategoryRow {
  id: number;
  name: string;
  created_at: Date;
}

function toCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    created_at: row.created_at,
  };
}

export class PostgresCategoryRepository implements ICategoryRepository {
  /**
   * Return all thematic categories ordered by id ascending.
   */
  async findAll(): Promise<Category[]> {
    const result = await query<CategoryRow>(
      `SELECT id, name, created_at FROM categories ORDER BY id ASC`,
    );
    return result.rows.map(toCategory);
  }

  /**
   * Find a single category by its unique identifier.
   * Returns null when the category does not exist.
   */
  async findById(id: number): Promise<Category | null> {
    const result = await query<CategoryRow>(
      `SELECT id, name, created_at FROM categories WHERE id = $1 LIMIT 1`,
      [id],
    );
    return result.rows.length > 0 ? toCategory(result.rows[0]) : null;
  }

  /**
   * Find a category by its name (case-sensitive).
   * Returns null when no category with that name exists.
   */
  async findByName(name: string): Promise<Category | null> {
    const result = await query<CategoryRow>(
      `SELECT id, name, created_at FROM categories WHERE name = $1 LIMIT 1`,
      [name],
    );
    return result.rows.length > 0 ? toCategory(result.rows[0]) : null;
  }

  /**
   * Persist a new category and return the created entity.
   * The DB generates the id (SERIAL) and created_at (DEFAULT NOW()).
   */
  async create(name: string): Promise<Category> {
    const result = await query<CategoryRow>(
      `INSERT INTO categories (name) VALUES ($1) RETURNING id, name, created_at`,
      [name],
    );
    return toCategory(result.rows[0]);
  }

  /**
   * Update an existing category's name.
   * Returns the updated entity.
   */
  async update(id: number, name: string): Promise<Category> {
    const result = await query<CategoryRow>(
      `UPDATE categories SET name = $1 WHERE id = $2 RETURNING id, name, created_at`,
      [name, id],
    );
    if (result.rows.length === 0) {
      throw new Error(`Category with id ${id} not found`);
    }
    return toCategory(result.rows[0]);
  }

  /**
   * Permanently remove a category by its unique identifier.
   */
  async delete(id: number): Promise<void> {
    await query(`DELETE FROM categories WHERE id = $1`, [id]);
  }
}
