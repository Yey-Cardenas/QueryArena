/**
 * IDashboardUseCase — Driving port for the student progress dashboard.
 * Controllers depend on this interface, never on the concrete implementation.
 * No external dependencies — pure TypeScript types only.
 */

import type { AttemptStatus } from '../../entities/Attempt';

/** Top-level summary shown in the student dashboard header. */
export interface DashboardSummary {
  /** Number of unique exercises the student has attempted at least once. */
  total_attempted: number;
  /** Number of exercises the student has resolved correctly at least once. */
  total_correct: number;
  /** Sum of scores from all correct attempts. */
  accumulated_score: number;
  /** Current position in the global ranking (1-based). */
  ranking_position: number;
}

/** Progress counters grouped by difficulty level. */
export interface LevelProgress {
  level_id: number;
  level_name: string;
  exercises_attempted: number;
  exercises_correct: number;
}

/** Progress counters grouped by thematic category. */
export interface CategoryProgress {
  category_id: number;
  category_name: string;
  exercises_attempted: number;
  exercises_correct: number;
}

/** One entry in the recent attempt history (last 10). */
export interface RecentAttempt {
  attempt_id: string;
  exercise_title: string;
  status: AttemptStatus;
  score: number;
  created_at: Date;
}

export interface IDashboardUseCase {
  /**
   * Returns the top-level summary for the student's dashboard.
   * Returns zero-value counters when the student has no attempts.
   */
  getSummary(userId: string): Promise<DashboardSummary>;

  /**
   * Returns per-level attempt and correct-resolution counts for the student.
   */
  getProgressByLevel(userId: string): Promise<LevelProgress[]>;

  /**
   * Returns per-category attempt and correct-resolution counts for the student.
   */
  getProgressByCategory(userId: string): Promise<CategoryProgress[]>;

  /**
   * Returns the 10 most recent attempts by the student, ordered by created_at DESC.
   */
  getRecentHistory(userId: string): Promise<RecentAttempt[]>;
}
