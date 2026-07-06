/**
 * attempt.mapper.ts
 * Maps a raw PostgreSQL row to the Attempt domain entity.
 * No external dependencies beyond the domain entity type.
 */

import type { Attempt, AttemptStatus } from '../../../../domain/entities/Attempt';

/**
 * Shape of a row returned from the `attempts` table.
 * All columns are snake_case as they come from PostgreSQL.
 */
export interface AttemptRow {
  id: string;
  user_id: string;
  exercise_id: string;
  query_sent: string;
  status: string;
  score: number;
  resolution_time_ms: number;
  created_at: Date;
}

/**
 * Convert a raw database row to an Attempt domain entity.
 * Casts the `status` string to the AttemptStatus union type — the DB CHECK
 * constraint guarantees only 'correct' | 'incorrect' | 'error' values are stored.
 */
export function toAttempt(row: AttemptRow): Attempt {
  return {
    id: row.id,
    user_id: row.user_id,
    exercise_id: row.exercise_id,
    query_sent: row.query_sent,
    status: row.status as AttemptStatus,
    score: row.score,
    resolution_time_ms: row.resolution_time_ms,
    created_at: row.created_at,
  };
}
