/**
 * ExerciseController — HTTP handlers for exercise catalogue endpoints.
 *
 * Handlers are plain Express request handlers that:
 *  1. Extract query parameters or path parameters from the request.
 *  2. Delegate to the use case via the DI container.
 *  3. Return the appropriate HTTP response on success.
 *  4. Forward any error to the global errorHandler via next(err).
 */

import type { Request, Response, NextFunction } from 'express';
import { container } from '../../../../infrastructure/container';

// ---------------------------------------------------------------------------
// GET /api/exercises
// ---------------------------------------------------------------------------

/**
 * Returns the list of active exercises, optionally filtered by level or category.
 *
 * Requires: authenticate middleware (req.user must be set), role: student or admin
 * Query params: level_id? (number), category_id? (number)
 * Success:  200 ExerciseSummary[]
 * Failure:  forwarded to errorHandler
 */
export async function listExercises(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { level_id, category_id } = req.query as {
      level_id?: string;
      category_id?: string;
    };

    // Validate numeric query params — reject NaN before passing to the use case.
    const parsedLevelId    = level_id    !== undefined ? Number(level_id)    : undefined;
    const parsedCategoryId = category_id !== undefined ? Number(category_id) : undefined;

    if (parsedLevelId !== undefined && !Number.isInteger(parsedLevelId)) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'level_id must be an integer.' } });
      return;
    }
    if (parsedCategoryId !== undefined && !Number.isInteger(parsedCategoryId)) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'category_id must be an integer.' } });
      return;
    }

    const filters = {
      ...(parsedLevelId    !== undefined && { level_id:    parsedLevelId }),
      ...(parsedCategoryId !== undefined && { category_id: parsedCategoryId }),
    };

    const exercises = await container.exerciseUseCase.listExercises(filters);
    res.status(200).json(exercises);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /api/exercises/:id
// ---------------------------------------------------------------------------

/**
 * Returns the full detail of a single exercise by its ID.
 *
 * Requires: authenticate middleware (req.user must be set)
 * Path param: id (UUID)
 * Success:  200 ExerciseDetail
 * Failure:  forwarded to errorHandler (404 EXERCISE_NOT_FOUND, etc.)
 */
export async function getExerciseById(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    const exercise = await container.exerciseUseCase.getExerciseById(id);
    res.status(200).json(exercise);
  } catch (err) {
    next(err);
  }
}
