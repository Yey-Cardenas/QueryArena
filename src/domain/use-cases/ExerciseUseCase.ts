/**
 * ExerciseUseCase — application service for the exercise catalogue.
 *
 * Pure domain logic: no framework imports, no infrastructure dependencies.
 * All I/O is delegated to the injected IExerciseRepository output port.
 */

import type {
  IExerciseUseCase,
  ExerciseSummary,
  ExerciseDetail,
  ExerciseFilters,
} from '../ports/in/IExerciseUseCase';
import type { IExerciseRepository } from '../ports/out/IExerciseRepository';
import type { Exercise } from '../entities/Exercise';

// ---------------------------------------------------------------------------
// Domain error types
// ---------------------------------------------------------------------------

export interface DomainError {
  code: 'EXERCISE_NOT_FOUND';
  message: string;
}

function domainError(err: DomainError): DomainError {
  return err;
}

// ---------------------------------------------------------------------------
// Mappers — Exercise entity → DTO projections
// ---------------------------------------------------------------------------

/**
 * Map a full Exercise entity to the summary DTO shown in catalogue listings.
 * Requires level and category to be embedded in the entity (joined from DB).
 */
function toSummary(exercise: Exercise): ExerciseSummary {
  return {
    id: exercise.id,
    title: exercise.title,
    description: exercise.description,
    level: {
      id: exercise.level!.id,
      name: exercise.level!.name,
    },
    category: {
      id: exercise.category!.id,
      name: exercise.category!.name,
    },
  };
}

/**
 * Map a full Exercise entity to the detail DTO shown when a student opens an exercise.
 * `enunciado` is the complete problem statement — mapped from `description` per the
 * IExerciseUseCase contract (ExerciseDetail extends ExerciseSummary with enunciado + score).
 */
function toDetail(exercise: Exercise): ExerciseDetail {
  return {
    ...toSummary(exercise),
    enunciado: exercise.description,
    score: exercise.score,
  };
}

// ---------------------------------------------------------------------------
// ExerciseUseCase
// ---------------------------------------------------------------------------

export class ExerciseUseCase implements IExerciseUseCase {
  constructor(private readonly exerciseRepository: IExerciseRepository) {}

  // -------------------------------------------------------------------------
  // listExercises
  // -------------------------------------------------------------------------

  async listExercises(filters?: ExerciseFilters): Promise<ExerciseSummary[]> {
    const exercises = await this.exerciseRepository.findAll({
      level_id: filters?.level_id,
      category_id: filters?.category_id,
    });

    // Only return active exercises — the repository may return all rows, so we
    // filter here in the domain to ensure the business rule is always enforced
    // regardless of the underlying adapter's implementation.
    return exercises
      .filter((e) => e.is_active)
      .map(toSummary);
  }

  // -------------------------------------------------------------------------
  // getExerciseById
  // -------------------------------------------------------------------------

  async getExerciseById(exerciseId: string): Promise<ExerciseDetail> {
    const exercise = await this.exerciseRepository.findById(exerciseId);

    if (exercise === null) {
      throw domainError({
        code: 'EXERCISE_NOT_FOUND',
        message: 'Exercise not found.',
      });
    }

    return toDetail(exercise);
  }
}
