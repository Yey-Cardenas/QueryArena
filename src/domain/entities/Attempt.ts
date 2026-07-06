/**
 * Attempt domain entity.
 * No external dependencies — pure TypeScript types only.
 */

export type AttemptStatus = 'correct' | 'incorrect' | 'error';

export interface Attempt {
  id: string;                   // UUID
  user_id: string;              // UUID — references User.id
  exercise_id: string;          // UUID — references Exercise.id
  query_sent: string;
  status: AttemptStatus;
  score: number;
  resolution_time_ms: number;
  created_at: Date;
}
