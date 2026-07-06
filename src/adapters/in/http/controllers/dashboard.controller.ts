/**
 * DashboardController — HTTP handlers for the student progress dashboard.
 *
 * Handlers are plain Express request handlers that:
 *  1. Read the authenticated user from req.user (set by authenticate middleware).
 *  2. Delegate to the use case via the DI container.
 *  3. Return the appropriate HTTP response on success.
 *  4. Forward any error to the global errorHandler via next(err).
 */

import type { Request, Response, NextFunction } from 'express';
import { container } from '../../../../infrastructure/container';

// ---------------------------------------------------------------------------
// GET /api/dashboard/summary
// ---------------------------------------------------------------------------

/**
 * Returns the top-level summary for the authenticated student's dashboard:
 * total exercises attempted, total correct, accumulated score, ranking position.
 *
 * Requires: authenticate middleware (req.user must be set), role: student
 * Success:  200 DashboardSummary
 * Failure:  forwarded to errorHandler
 */
export async function getSummary(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const summary = await container.dashboardUseCase.getSummary(userId);
    res.status(200).json(summary);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /api/dashboard/progress/level
// ---------------------------------------------------------------------------

/**
 * Returns per-level attempt and correct-resolution counts for the student.
 *
 * Requires: authenticate middleware (req.user must be set), role: student
 * Success:  200 LevelProgress[]
 * Failure:  forwarded to errorHandler
 */
export async function getProgressByLevel(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const progress = await container.dashboardUseCase.getProgressByLevel(userId);
    res.status(200).json(progress);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /api/dashboard/progress/category
// ---------------------------------------------------------------------------

/**
 * Returns per-category attempt and correct-resolution counts for the student.
 *
 * Requires: authenticate middleware (req.user must be set), role: student
 * Success:  200 CategoryProgress[]
 * Failure:  forwarded to errorHandler
 */
export async function getProgressByCategory(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const progress = await container.dashboardUseCase.getProgressByCategory(userId);
    res.status(200).json(progress);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /api/dashboard/history
// ---------------------------------------------------------------------------

/**
 * Returns the 10 most recent attempts by the authenticated student,
 * ordered by created_at DESC.
 *
 * Requires: authenticate middleware (req.user must be set), role: student
 * Success:  200 RecentAttempt[]
 * Failure:  forwarded to errorHandler
 */
export async function getRecentHistory(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const history = await container.dashboardUseCase.getRecentHistory(userId);
    res.status(200).json(history);
  } catch (err) {
    next(err);
  }
}
