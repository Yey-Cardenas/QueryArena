/**
 * IAttemptUseCase — Driving port for submitting and querying exercise attempts.
 * Controllers depend on this interface, never on the concrete implementation.
 * No external dependencies — pure TypeScript types only.
 */

import type { AttemptStatus } from '../../entities/Attempt';

/** Result returned immediately after submitting an attempt. */
export interface AttemptResult {
  attempt_id: string;
  status: AttemptStatus;
  score: number;
  resolution_time_ms: number;
  /** Guidance message for incorrect/error attempts; null for correct ones. */
  hint: string | null;
}

/** Single entry in the attempt history list. */
export interface AttemptHistoryItem {
  id: string;
  exercise_id: string;
  query_sent: string;
  status: AttemptStatus;
  score: number;
  resolution_time_ms: number;
  created_at: Date;
}

export interface IAttemptUseCase {
  /**
   * Records and evaluates a student's SQL attempt for a given exercise.
   * Throws EXERCISE_NOT_FOUND if the exercise does not exist.
   * Throws EMPTY_QUERY if querySent is blank.
   */
  submitAttempt(
    userId: string,
    exerciseId: string,
    querySent: string,
    resolutionTimeMs: number,
  ): Promise<AttemptResult>;

  /**
   * Returns all attempts by the user, ordered by created_at DESC.
   * Optionally filtered to a single exercise when exerciseId is provided.
   */
  getAttemptHistory(
    userId: string,
    exerciseId?: string,
  ): Promise<AttemptHistoryItem[]>;
}
