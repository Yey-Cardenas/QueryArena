/**
 * PostgresRankingRepository.ts
 * Implements IRankingRepository using the shared PostgreSQL connection pool.
 *
 * Rules:
 *  - Only parameterized queries ($1, $2, …) — never string interpolation.
 *  - upsert uses INSERT … ON CONFLICT (user_id) DO UPDATE to increment
 *    accumulated_score atomically and refresh last_correct_at.
 *  - findAll JOINs users to enrich each row with username.
 *  - No business logic here; that belongs in the use-case layer.
 */

import type { Ranking } from '../../../../domain/entities/Ranking';
import type { IRankingRepository } from '../../../../domain/ports/out/IRankingRepository';
import { query } from '../../../../infrastructure/database';

/** Shape of a raw row returned by findAll (includes username from JOIN). */
interface RankingWithUsernameRow {
  id: string;
  user_id: string;
  accumulated_score: string; // PostgreSQL returns numeric columns as strings via node-pg
  last_correct_at: Date | null;
  updated_at: Date;
  username: string;
}

/** Shape of a raw row returned by findByUser (rankings table only). */
interface RankingRow {
  id: string;
  user_id: string;
  accumulated_score: string;
  last_correct_at: Date | null;
  updated_at: Date;
}

/** Convert a raw DB row to the Ranking domain entity. */
function toRanking(row: RankingRow): Ranking {
  return {
    id: row.id,
    user_id: row.user_id,
    accumulated_score: parseInt(row.accumulated_score, 10),
    last_correct_at: row.last_correct_at,
    updated_at: row.updated_at,
  };
}

export class PostgresRankingRepository implements IRankingRepository {
  /**
   * Insert or update the ranking row for the given user.
   *
   * On insert: creates a new row with accumulated_score = scoreIncrement.
   * On conflict: increments accumulated_score by scoreIncrement and sets
   * last_correct_at = NOW() and updated_at = NOW().
   */
  async upsert(userId: string, scoreIncrement: number): Promise<void> {
    await query(
      `INSERT INTO rankings (user_id, accumulated_score, last_correct_at, updated_at)
            VALUES ($1, $2, NOW(), NOW())
       ON CONFLICT (user_id) DO UPDATE
               SET accumulated_score = rankings.accumulated_score + $2,
                   last_correct_at   = NOW(),
                   updated_at        = NOW()`,
      [userId, scoreIncrement],
    );
  }

  /**
   * Return all ranking rows joined with users for the username.
   * Ordered by accumulated_score DESC; ties broken by last_correct_at ASC
   * (NULL values — users who have never answered correctly — appear last).
   */
  async findAll(): Promise<(Ranking & { username: string })[]> {
    const result = await query<RankingWithUsernameRow>(
      `SELECT r.id,
              r.user_id,
              r.accumulated_score,
              r.last_correct_at,
              r.updated_at,
              u.username
         FROM rankings r
         JOIN users u ON u.id = r.user_id
        ORDER BY r.accumulated_score DESC,
                 r.last_correct_at   ASC NULLS LAST`,
    );

    return result.rows.map((row) => ({
      ...toRanking(row),
      username: row.username,
    }));
  }

  /**
   * Return the ranking entry for a single user, or null if none exists yet.
   */
  async findByUser(userId: string): Promise<Ranking | null> {
    const result = await query<RankingRow>(
      `SELECT id, user_id, accumulated_score, last_correct_at, updated_at
         FROM rankings
        WHERE user_id = $1
        LIMIT 1`,
      [userId],
    );

    if (result.rows.length === 0) return null;
    return toRanking(result.rows[0]);
  }
}
