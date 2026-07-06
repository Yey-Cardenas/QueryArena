/**
 * Output port — IExerciseRepository
 * Contract the domain requires from the exercise persistence adapter.
 * No external dependencies — imports only from domain entities.
 */

import type { Exercise } from '../../entities/Exercise';

export interface IExerciseRepository {
  /**
   * Return all exercises, optionally filtered by level and/or category.
   */
  findAll(filters?: { level_id?: number; category_id?: number }): Promise<Exercise[]>;

  /**
   * Find a single exercise by its unique identifier.
   * Returns null when the exercise does not exist.
   */
  findById(id: string): Promise<Exercise | null>;

  /**
   * Persist a new exercise and return the created entity.
   */
  create(data: Omit<Exercise, 'id' | 'created_at' | 'updated_at'>): Promise<Exercise>;

  /**
   * Update an existing exercise with the supplied partial data.
   * Returns the updated entity.
   */
  update(
    id: string,
    data: Partial<Omit<Exercise, 'id' | 'created_at'>>,
  ): Promise<Exercise>;

  /**
   * Permanently remove an exercise by its unique identifier.
   */
  delete(id: string): Promise<void>;

  /**
   * Count how many exercises belong to the given level.
   * Used to guard level deletion.
   */
  countByLevel(level_id: number): Promise<number>;

  /**
   * Count how many exercises belong to the given category.
   * Used to guard category deletion.
   */
  countByCategory(category_id: number): Promise<number>;
}
