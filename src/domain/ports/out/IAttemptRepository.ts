/**
 * Output port — IAttemptRepository
 * Contract the domain requires from the attempt persistence adapter.
 * No external dependencies — imports only from domain entities.
 */

import type { Attempt } from '../../entities/Attempt';

export interface IAttemptRepository {
  /**
   * Persist a new attempt and return the created entity.
   */
  create(data: Omit<Attempt, 'id' | 'created_at'>): Promise<Attempt>;

  /**
   * Return all attempts for the given user, optionally filtered by exercise.
   * Results should be ordered by created_at descending.
   * May include exercise_title when the repository joins with the exercises table.
   */
  findByUser(userId: string, exerciseId?: string): Promise<(Attempt & { exercise_title?: string | null })[]>;

  /**
   * Update the status and/or score of an existing attempt.
   * Returns the updated entity.
   */
  update(
    id: string,
    data: Partial<Pick<Attempt, 'status' | 'score'>>,
  ): Promise<Attempt>;

  /**
   * Count how many attempts reference the given exercise.
   * Used to guard exercise deletion.
   */
  countByExercise(exerciseId: string): Promise<number>;
}
