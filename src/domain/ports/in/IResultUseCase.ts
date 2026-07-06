/**
 * IResultUseCase — Driving port for evaluating attempt results.
 * Called internally by AttemptUseCase; not exposed directly via HTTP.
 * No external dependencies — pure TypeScript types only.
 */

import type { AttemptStatus } from '../../entities/Attempt';

export interface EvaluationResult {
  status: AttemptStatus;
  /** Points awarded. Must be > 0 when status = 'correct', 0 otherwise. */
  score: number;
  /** Guidance message for incorrect/error states; null when correct. */
  hint: string | null;
}

export interface IResultUseCase {
  /**
   * Compares querySent against expectedSolution and determines the outcome.
   *
   * Invariant: status='correct' → score=exerciseScore > 0
   *            status='incorrect'|'error' → score=0
   *
   * @param attemptId       UUID of the already-persisted attempt record.
   * @param querySent       SQL query submitted by the student.
   * @param expectedSolution The correct SQL solution for the exercise.
   * @param exerciseScore   Points to award on a correct evaluation.
   */
  evaluateAttempt(
    attemptId: string,
    querySent: string,
    expectedSolution: string,
    exerciseScore: number,
  ): Promise<EvaluationResult>;
}
