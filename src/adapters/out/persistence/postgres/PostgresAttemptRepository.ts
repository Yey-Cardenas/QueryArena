/**
 * PostgresAttemptRepository.ts
 * PostgreSQL adapter implementing IAttemptRepository.
 * Uses the shared `query` helper for all DB access (parameterized queries only).
 */

import type { IAttemptRepository } from '../../../../domain/ports/out/IAttemptRepository';
import type { Attempt } from '../../../../domain/entities/Attempt';
import { query } from '../../../../infrastructure/database';
import { toAttempt, type AttemptRow } from './attempt.mapper';

export class PostgresAttemptRepository implements IAttemptRepository {
  /**
   * Persist a new attempt and return the created entity.
   * The DB generates the id (gen_random_uuid()) and created_at (NOW()).
   */
  async create(data: Omit<Attempt, 'id' | 'created_at'>): Promise<Attempt> {
    const sql = `
      INSERT INTO attempts (user_id, exercise_id, query_sent, status, score, resolution_time_ms)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const params = [
      data.user_id,
      data.exercise_id,
      data.query_sent,
      data.status,
      data.score,
      data.resolution_time_ms,
    ];

    const result = await query<AttemptRow>(sql, params);
    return toAttempt(result.rows[0]);
  }

  /**
   * Return all attempts for the given user, optionally filtered by exercise.
   * Results are ordered by created_at descending (most recent first).
   * Joins with exercises to include the exercise title.
   */
  async findByUser(userId: string, exerciseId?: string): Promise<(Attempt & { exercise_title?: string | null })[]> {
    if (exerciseId !== undefined) {
      const sql = `
        SELECT a.*, e.title AS exercise_title
        FROM attempts a
        LEFT JOIN exercises e ON e.id = a.exercise_id
        WHERE a.user_id = $1
          AND a.exercise_id = $2
        ORDER BY a.created_at DESC
      `;
      const result = await query<AttemptRow>(sql, [userId, exerciseId]);
      return result.rows.map(toAttempt);
    }

    const sql = `
      SELECT a.*, e.title AS exercise_title
      FROM attempts a
      LEFT JOIN exercises e ON e.id = a.exercise_id
      WHERE a.user_id = $1
      ORDER BY a.created_at DESC
    `;
    const result = await query<AttemptRow>(sql, [userId]);
    return result.rows.map(toAttempt);
  }

  /**
   * Update the status and/or score of an existing attempt.
   * Returns the updated entity.
   */
  async update(
    id: string,
    data: Partial<Pick<Attempt, 'status' | 'score'>>,
  ): Promise<Attempt> {
    // Build SET clause dynamically from the provided fields.
    const setClauses: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (data.status !== undefined) {
      setClauses.push(`status = $${paramIndex}`);
      params.push(data.status);
      paramIndex += 1;
    }

    if (data.score !== undefined) {
      setClauses.push(`score = $${paramIndex}`);
      params.push(data.score);
      paramIndex += 1;
    }

    // Nothing to update — return the existing record unchanged.
    if (setClauses.length === 0) {
      const result = await query<AttemptRow>(
        'SELECT * FROM attempts WHERE id = $1',
        [id],
      );
      return toAttempt(result.rows[0]);
    }

    params.push(id);
    const sql = `
      UPDATE attempts
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await query<AttemptRow>(sql, params);
    return toAttempt(result.rows[0]);
  }

  /**
   * Count how many attempts reference the given exercise.
   * Used to guard exercise deletion (reject if count > 0).
   */
  async countByExercise(exerciseId: string): Promise<number> {
    const sql = `
      SELECT COUNT(*)::int AS count
      FROM attempts
      WHERE exercise_id = $1
    `;
    const result = await query<{ count: number }>(sql, [exerciseId]);
    return result.rows[0].count;
  }
}
