/**
 * DashboardUseCase — application service for the student progress dashboard.
 *
 * Pure domain logic: no framework imports, no infrastructure dependencies.
 * All I/O is delegated to injected output ports.
 *
 * Responsibilities:
 *   - getSummary        → total attempted, total correct, accumulated score, ranking position
 *   - getProgressByLevel    → per-level attempt and correct counts
 *   - getProgressByCategory → per-category attempt and correct counts
 *   - getRecentHistory  → last 10 attempts with exercise title, status, score and date
 */

import type {
  IDashboardUseCase,
  DashboardSummary,
  LevelProgress,
  CategoryProgress,
  RecentAttempt,
} from '../ports/in/IDashboardUseCase';
import type { IAttemptRepository } from '../ports/out/IAttemptRepository';
import type { IExerciseRepository } from '../ports/out/IExerciseRepository';
import type { IRankingRepository } from '../ports/out/IRankingRepository';

// ---------------------------------------------------------------------------
// DashboardUseCase
// ---------------------------------------------------------------------------

export class DashboardUseCase implements IDashboardUseCase {
  constructor(
    private readonly attemptRepository: IAttemptRepository,
    private readonly exerciseRepository: IExerciseRepository,
    private readonly rankingRepository: IRankingRepository,
  ) {}

  // -------------------------------------------------------------------------
  // getSummary
  // -------------------------------------------------------------------------

  /**
   * Returns the top-level summary for the student's dashboard.
   * Returns zero-value counters when the student has no attempts.
   *
   * - total_attempted   = number of unique exercises the student has attempted
   * - total_correct     = number of exercises resolved correctly at least once
   * - accumulated_score = sum of scores from all correct attempts (from ranking)
   * - ranking_position  = 1-based position in the global ranking
   */
  async getSummary(userId: string): Promise<DashboardSummary> {
    // Fetch all attempts for this student (no exercise filter → full history)
    const attempts = await this.attemptRepository.findByUser(userId);

    // Unique exercises attempted
    const uniqueExerciseIds = new Set(attempts.map((a) => a.exercise_id));
    const total_attempted = uniqueExerciseIds.size;

    // Exercises resolved correctly at least once
    const correctExerciseIds = new Set(
      attempts
        .filter((a) => a.status === 'correct')
        .map((a) => a.exercise_id),
    );
    const total_correct = correctExerciseIds.size;

    // Accumulated score from the ranking record (authoritative source)
    const rankingEntry = await this.rankingRepository.findByUser(userId);
    const accumulated_score = rankingEntry?.accumulated_score ?? 0;

    // Ranking position: fetch the full ordered list and find the student's slot
    const rankingList = await this.rankingRepository.findAll();
    const ranking_position = this._computeRankingPosition(userId, rankingList);

    return {
      total_attempted,
      total_correct,
      accumulated_score,
      ranking_position,
    };
  }

  // -------------------------------------------------------------------------
  // getProgressByLevel
  // -------------------------------------------------------------------------

  /**
   * Returns per-level attempt and correct-resolution counts for the student.
   *
   * For each level that the student has touched (via attempts), we count:
   *   - exercises_attempted = unique exercises attempted in that level
   *   - exercises_correct   = unique exercises resolved correctly in that level
   */
  async getProgressByLevel(userId: string): Promise<LevelProgress[]> {
    const attempts = await this.attemptRepository.findByUser(userId);

    if (attempts.length === 0) {
      return [];
    }

    // Resolve exercise metadata for every unique exercise in the attempt history
    const exerciseMap = await this._resolveExercises(attempts.map((a) => a.exercise_id));

    // Group by level
    const levelMap = new Map<
      number,
      { level_name: string; attempted: Set<string>; correct: Set<string> }
    >();

    for (const attempt of attempts) {
      const exercise = exerciseMap.get(attempt.exercise_id);
      if (!exercise?.level) continue; // skip if exercise or level is missing

      const { id: level_id, name: level_name } = exercise.level;

      if (!levelMap.has(level_id)) {
        levelMap.set(level_id, {
          level_name,
          attempted: new Set(),
          correct: new Set(),
        });
      }

      const entry = levelMap.get(level_id)!;
      entry.attempted.add(attempt.exercise_id);

      if (attempt.status === 'correct') {
        entry.correct.add(attempt.exercise_id);
      }
    }

    // Convert to output DTOs, sorted by level_id ascending for stable output
    return Array.from(levelMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([level_id, { level_name, attempted, correct }]) => ({
        level_id,
        level_name,
        exercises_attempted: attempted.size,
        exercises_correct: correct.size,
      }));
  }

  // -------------------------------------------------------------------------
  // getProgressByCategory
  // -------------------------------------------------------------------------

  /**
   * Returns per-category attempt and correct-resolution counts for the student.
   *
   * For each category that the student has touched (via attempts), we count:
   *   - exercises_attempted = unique exercises attempted in that category
   *   - exercises_correct   = unique exercises resolved correctly in that category
   */
  async getProgressByCategory(userId: string): Promise<CategoryProgress[]> {
    const attempts = await this.attemptRepository.findByUser(userId);

    if (attempts.length === 0) {
      return [];
    }

    // Resolve exercise metadata
    const exerciseMap = await this._resolveExercises(attempts.map((a) => a.exercise_id));

    // Group by category
    const categoryMap = new Map<
      number,
      { category_name: string; attempted: Set<string>; correct: Set<string> }
    >();

    for (const attempt of attempts) {
      const exercise = exerciseMap.get(attempt.exercise_id);
      if (!exercise?.category) continue; // skip if exercise or category is missing

      const { id: category_id, name: category_name } = exercise.category;

      if (!categoryMap.has(category_id)) {
        categoryMap.set(category_id, {
          category_name,
          attempted: new Set(),
          correct: new Set(),
        });
      }

      const entry = categoryMap.get(category_id)!;
      entry.attempted.add(attempt.exercise_id);

      if (attempt.status === 'correct') {
        entry.correct.add(attempt.exercise_id);
      }
    }

    // Convert to output DTOs, sorted by category_id ascending for stable output
    return Array.from(categoryMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([category_id, { category_name, attempted, correct }]) => ({
        category_id,
        category_name,
        exercises_attempted: attempted.size,
        exercises_correct: correct.size,
      }));
  }

  // -------------------------------------------------------------------------
  // getRecentHistory
  // -------------------------------------------------------------------------

  /**
   * Returns the 10 most recent attempts by the student, ordered by created_at DESC.
   *
   * The IAttemptRepository already returns attempts ordered by created_at DESC,
   * so we just take the first 10 and enrich each with the exercise title.
   */
  async getRecentHistory(userId: string): Promise<RecentAttempt[]> {
    const attempts = await this.attemptRepository.findByUser(userId);

    // Limit to the 10 most recent (repository returns DESC order)
    const recent = attempts.slice(0, 10);

    if (recent.length === 0) {
      return [];
    }

    // Resolve exercise titles
    const exerciseMap = await this._resolveExercises(recent.map((a) => a.exercise_id));

    return recent.map((attempt) => ({
      attempt_id: attempt.id,
      exercise_title: exerciseMap.get(attempt.exercise_id)?.title ?? 'Unknown exercise',
      status: attempt.status,
      score: attempt.score,
      created_at: attempt.created_at,
    }));
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Resolves a list of exercise IDs to a Map<id, Exercise>.
   * Deduplicates IDs to minimise repository calls.
   */
  private async _resolveExercises(
    exerciseIds: string[],
  ): Promise<Map<string, Awaited<ReturnType<IExerciseRepository['findById']>> extends infer T ? NonNullable<T> : never>> {
    const uniqueIds = Array.from(new Set(exerciseIds));

    const exercises = await Promise.all(
      uniqueIds.map((id) => this.exerciseRepository.findById(id)),
    );

    const map = new Map<string, NonNullable<Awaited<ReturnType<IExerciseRepository['findById']>>>>();

    for (let i = 0; i < uniqueIds.length; i++) {
      const exercise = exercises[i];
      if (exercise !== null) {
        map.set(uniqueIds[i], exercise);
      }
    }

    return map;
  }

  /**
   * Computes the 1-based ranking position for the given user from the full
   * ranking list (already ordered by accumulated_score DESC, last_correct_at ASC).
   *
   * Students with the same accumulated_score share the same position.
   * If the student has no ranking entry yet, they are placed last (position = list length + 1).
   */
  private _computeRankingPosition(
    userId: string,
    rankingList: Array<{ user_id: string; accumulated_score: number }>,
  ): number {
    if (rankingList.length === 0) {
      return 1;
    }

    const userEntry = rankingList.find((r) => r.user_id === userId);

    // Student not in the ranking list yet (no correct attempts / no record)
    if (!userEntry) {
      // They effectively tie at the bottom with score 0; everyone with score > 0
      // precedes them. Count entries with accumulated_score > 0 and add 1.
      const aheadCount = rankingList.filter((r) => r.accumulated_score > 0).length;
      return aheadCount + 1;
    }

    // Find the first index in the sorted list that has the same score —
    // that defines the shared position for all tied students.
    const firstIndexWithSameScore = rankingList.findIndex(
      (r) => r.accumulated_score === userEntry.accumulated_score,
    );

    return firstIndexWithSameScore + 1; // convert 0-based index to 1-based position
  }
}
