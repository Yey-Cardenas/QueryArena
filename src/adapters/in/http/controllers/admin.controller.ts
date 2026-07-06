/**
 * AdminController — HTTP handlers for admin CRUD endpoints.
 *
 * Handles management of levels, categories, and exercises.
 * All handlers require authenticate + authorize('admin') middleware.
 *
 * Handlers follow the same pattern as other controllers:
 *  1. Extract parameters from the request (body, params, query).
 *  2. Delegate to the use case via the DI container.
 *  3. Return the appropriate HTTP response on success.
 *  4. Forward any error to the global errorHandler via next(err).
 */

import type { Request, Response, NextFunction } from 'express';
import { container } from '../../../../infrastructure/container';
import type { CreateExerciseDto } from '../../../../domain/ports/in/IAdminUseCase';

// ===========================================================================
// Level handlers
// ===========================================================================

/**
 * POST /api/admin/levels
 * Body: { name: string }
 * Success: 201 Level
 */
export async function createLevel(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { name } = req.body as { name: string };
    const level = await container.adminUseCase.createLevel(name);
    res.status(201).json(level);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/admin/levels
 * Success: 200 Level[]
 */
export async function listLevels(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const levels = await container.adminUseCase.listLevels();
    res.status(200).json(levels);
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/admin/levels/:id
 * Params: id (number)
 * Body: { name: string }
 * Success: 200 Level
 */
export async function updateLevel(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = Number(req.params.id);
    const { name } = req.body as { name: string };
    const level = await container.adminUseCase.updateLevel(id, name);
    res.status(200).json(level);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/admin/levels/:id
 * Params: id (number)
 * Success: 204 No Content
 */
export async function deleteLevel(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = Number(req.params.id);
    await container.adminUseCase.deleteLevel(id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// ===========================================================================
// Category handlers
// ===========================================================================

/**
 * POST /api/admin/categories
 * Body: { name: string }
 * Success: 201 Category
 */
export async function createCategory(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { name } = req.body as { name: string };
    const category = await container.adminUseCase.createCategory(name);
    res.status(201).json(category);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/admin/categories
 * Success: 200 Category[]
 */
export async function listCategories(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const categories = await container.adminUseCase.listCategories();
    res.status(200).json(categories);
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/admin/categories/:id
 * Params: id (number)
 * Body: { name: string }
 * Success: 200 Category
 */
export async function updateCategory(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = Number(req.params.id);
    const { name } = req.body as { name: string };
    const category = await container.adminUseCase.updateCategory(id, name);
    res.status(200).json(category);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/admin/categories/:id
 * Params: id (number)
 * Success: 204 No Content
 */
export async function deleteCategory(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = Number(req.params.id);
    await container.adminUseCase.deleteCategory(id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// ===========================================================================
// Exercise handlers
// ===========================================================================

/**
 * POST /api/admin/exercises
 * Body: CreateExerciseDto
 * Success: 201 Exercise
 */
export async function createExercise(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = req.body as CreateExerciseDto;
    const exercise = await container.adminUseCase.createExercise(data);
    res.status(201).json(exercise);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/admin/exercises
 * Returns all exercises (including inactive ones) for admin review.
 * Success: 200 Exercise[]
 */
export async function listExercisesAdmin(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const exercises = await container.adminUseCase.listExercisesAdmin();
    res.status(200).json(exercises);
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/admin/exercises/:id
 * Params: id (UUID)
 * Body: Partial<CreateExerciseDto>
 * Success: 200 Exercise
 */
export async function updateExercise(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    const data = req.body as Partial<CreateExerciseDto>;
    const exercise = await container.adminUseCase.updateExercise(id, data);
    res.status(200).json(exercise);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/admin/exercises/:id
 * Params: id (UUID)
 * Success: 204 No Content
 */
export async function deleteExercise(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    await container.adminUseCase.deleteExercise(id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
