/**
 * PostgresExerciseRepository.ts
 * PostgreSQL adapter that implements IExerciseRepository.
 *
 * All queries are parameterized — string interpolation is never used for
 * user-supplied or externally-sourced values.
 *
 * The SELECT base query always JOINs levels and categories so that the
 * mapper receives the full data needed to build embedded Level/Category objects.
 */

import type { Exercise } from '../../../../domain/entities/Exercise';
import type { IExerciseRepository } from '../../../../domain/ports/out/IExerciseRepository';
import { query } from '../../../../infrastructure/database';
import { mapRowToExercise, ExerciseRow } from './exercise.mapper';

/**
 * BASE SELECT — retrieves all columns needed by the mapper.
 * Aliases the joined columns to avoid ambiguity and match ExerciseRow.
 */
const BASE_SELECT = `
  SELECT
    e.id,
    e.title,
    e.description,
    e.expected_solution,
    e.score,
    e.is_active,
    e.level_id,
    e.category_id,
    e.created_at,
    e.updated_at,
    l.name        AS level_name,
    l.created_at  AS level_created_at,
    c.name        AS category_name,
    c.created_at  AS category_created_at
  FROM exercises e
  JOIN levels     l ON l.id = e.level_id
  JOIN categories c ON c.id = e.category_id
`;

export class PostgresExerciseRepository implements IExerciseRepository {
  /**
   * Return all exercises, optionally filtered by level_id and/or category_id.
   * No filter = all exercises (including inactive ones) — callers such as
   * ExerciseUseCase are responsible for applying the `is_active` business rule.
   */
  async findAll(filters?: { level_id?: number; category_id?: number }): Promise<Exercise[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters?.level_id !== undefined) {
      params.push(filters.level_id);
      conditions.push(`e.level_id = $${params.length}`);
    }

    if (filters?.category_id !== undefined) {
      params.push(filters.category_id);
      conditions.push(`e.category_id = $${params.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `${BASE_SELECT} ${where} ORDER BY e.created_at DESC`;

    const result = await query<ExerciseRow>(sql, params);
    return result.rows.map(mapRowToExercise);
  }

  /**
   * Find a single exercise by UUID.
   * Returns null when no exercise with the given id exists.
   */
  async findById(id: string): Promise<Exercise | null> {
    const sql = `${BASE_SELECT} WHERE e.id = $1`;
    const result = await query<ExerciseRow>(sql, [id]);

    if (result.rows.length === 0) return null;
    return mapRowToExercise(result.rows[0]);
  }

  /**
   * Persist a new exercise.
   * The database generates the UUID and timestamps via DEFAULT values.
   */
  async create(
    data: Omit<Exercise, 'id' | 'created_at' | 'updated_at'>,
  ): Promise<Exercise> {
    const sql = `
      INSERT INTO exercises (title, description, expected_solution, score, is_active, level_id, category_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `;

    const insertResult = await query<{ id: string }>(sql, [
      data.title,
      data.description,
      data.expected_solution,
      data.score,
      data.is_active,
      data.level_id,
      data.category_id,
    ]);

    const newId = insertResult.rows[0].id;

    // Re-fetch via findById so the returned entity always includes embedded level/category.
    const created = await this.findById(newId);
    if (!created) {
      throw new Error(`Failed to retrieve exercise after insert (id=${newId})`);
    }
    return created;
  }

  /**
   * Update an existing exercise with partial data.
   * Only provided fields are updated; `updated_at` is always refreshed.
   * Returns the updated entity (with embedded level/category).
   */
  async update(
    id: string,
    data: Partial<Omit<Exercise, 'id' | 'created_at'>>,
  ): Promise<Exercise> {
    const setClauses: string[] = [];
    const params: unknown[] = [];

    const fields: Array<keyof typeof data> = [
      'title',
      'description',
      'expected_solution',
      'score',
      'is_active',
      'level_id',
      'category_id',
    ];

    for (const field of fields) {
      if (data[field] !== undefined) {
        params.push(data[field]);
        setClauses.push(`${field} = $${params.length}`);
      }
    }

    // Always bump updated_at
    setClauses.push(`updated_at = NOW()`);

    // Push the id as the final parameter for the WHERE clause
    params.push(id);

    const sql = `
      UPDATE exercises
      SET ${setClauses.join(', ')}
      WHERE id = $${params.length}
    `;

    await query(sql, params);

    const updated = await this.findById(id);
    if (!updated) {
      throw new Error(`Exercise not found after update (id=${id})`);
    }
    return updated;
  }

  /**
   * Permanently delete an exercise by UUID.
   * The caller (AdminUseCase) is responsible for checking attempts first.
   */
  async delete(id: string): Promise<void> {
    const sql = `DELETE FROM exercises WHERE id = $1`;
    await query(sql, [id]);
  }

  /**
   * Count exercises that belong to a given level.
   * Used by AdminUseCase to guard level deletion.
   */
  async countByLevel(level_id: number): Promise<number> {
    const sql = `SELECT COUNT(*)::int AS count FROM exercises WHERE level_id = $1`;
    const result = await query<{ count: number }>(sql, [level_id]);
    return result.rows[0].count;
  }

  /**
   * Count exercises that belong to a given category.
   * Used by AdminUseCase to guard category deletion.
   */
  async countByCategory(category_id: number): Promise<number> {
    const sql = `SELECT COUNT(*)::int AS count FROM exercises WHERE category_id = $1`;
    const result = await query<{ count: number }>(sql, [category_id]);
    return result.rows[0].count;
  }
}
