/**
 * IAdminUseCase — Driving port for admin CRUD operations.
 * Controllers depend on this interface, never on the concrete implementation.
 * No external dependencies — pure TypeScript types only.
 */

import type { Exercise, Level, Category } from '../../entities/Exercise';

// ---------------------------------------------------------------------------
// DTO types
// ---------------------------------------------------------------------------

/** Data required to create a new exercise. */
export interface CreateExerciseDto {
  title: string;
  description: string;
  /** Full problem statement shown to the student. */
  enunciado: string;
  expected_solution: string;
  score: number;
  level_id: number;
  category_id: number;
}

// ---------------------------------------------------------------------------
// Port interface
// ---------------------------------------------------------------------------

export interface IAdminUseCase {
  // --- Level CRUD -----------------------------------------------------------

  /**
   * Creates a new difficulty level.
   * Throws NAME_ALREADY_EXISTS if the name is already in use.
   */
  createLevel(name: string): Promise<Level>;

  /**
   * Updates an existing level's name.
   * Throws NAME_ALREADY_EXISTS if the new name conflicts with another level.
   */
  updateLevel(id: number, name: string): Promise<Level>;

  /**
   * Deletes a level.
   * Throws HAS_ASSOCIATED_EXERCISES (atomically) if the level has exercises.
   */
  deleteLevel(id: number): Promise<void>;

  /** Returns all levels. */
  listLevels(): Promise<Level[]>;

  // --- Category CRUD --------------------------------------------------------

  /**
   * Creates a new thematic category.
   * Throws NAME_ALREADY_EXISTS if the name is already in use.
   */
  createCategory(name: string): Promise<Category>;

  /**
   * Updates an existing category's name.
   * Throws NAME_ALREADY_EXISTS if the new name conflicts with another category.
   */
  updateCategory(id: number, name: string): Promise<Category>;

  /**
   * Deletes a category.
   * Throws HAS_ASSOCIATED_EXERCISES (atomically) if the category has exercises.
   */
  deleteCategory(id: number): Promise<void>;

  /** Returns all categories. */
  listCategories(): Promise<Category[]>;

  // --- Exercise CRUD --------------------------------------------------------

  /**
   * Creates a new exercise.
   * Throws INVALID_REFERENCE if level_id or category_id do not exist.
   * Throws VALIDATION_ERROR if any required field is missing or empty.
   */
  createExercise(data: CreateExerciseDto): Promise<Exercise>;

  /**
   * Updates an existing exercise with partial data.
   * Throws INVALID_REFERENCE if the provided level_id or category_id do not exist.
   */
  updateExercise(id: string, data: Partial<CreateExerciseDto>): Promise<Exercise>;

  /**
   * Deletes an exercise.
   * Throws HAS_ASSOCIATED_ATTEMPTS if the exercise has recorded attempts.
   */
  deleteExercise(id: string): Promise<void>;

  /** Returns all exercises (including inactive ones) for admin review. */
  listExercisesAdmin(): Promise<Exercise[]>;
}
