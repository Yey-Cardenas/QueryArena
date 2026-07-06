/**
 * IExerciseUseCase — Driving port for the exercise catalogue.
 * Controllers depend on this interface, never on the concrete implementation.
 * No external dependencies — pure TypeScript types only.
 */

/** Summary projection returned by the catalogue listing (no expected_solution). */
export interface ExerciseSummary {
  id: string;
  title: string;
  description: string;
  level: { id: number; name: string };
  category: { id: number; name: string };
}

/** Full exercise projection returned when a student opens a specific exercise. */
export interface ExerciseDetail extends ExerciseSummary {
  /** Full problem statement shown to the student. */
  enunciado: string;
  score: number;
}

export interface ExerciseFilters {
  level_id?: number;
  category_id?: number;
}

export interface IExerciseUseCase {
  /**
   * Returns the list of active exercises, optionally filtered by level or category.
   * Only exercises with is_active = true are included.
   */
  listExercises(filters?: ExerciseFilters): Promise<ExerciseSummary[]>;

  /**
   * Returns the full detail of a single exercise by its ID.
   * Throws EXERCISE_NOT_FOUND if the exercise does not exist.
   */
  getExerciseById(exerciseId: string): Promise<ExerciseDetail>;
}
