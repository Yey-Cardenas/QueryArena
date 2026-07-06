/**
 * AttemptController — HTTP handlers for SQL attempt endpoints.
 *
 * Handlers are plain Express request handlers that:
 *  1. Extract body or query parameters from the request.
 *  2. Read the authenticated user from req.user (set by authenticate middleware).
 *  3. Delegate to the use case via the DI container.
 *  4. Return the appropriate HTTP response on success.
 *  5. Forward any error to the global errorHandler via next(err).
 */

import type { Request, Response, NextFunction } from 'express';
import { container } from '../../../../infrastructure/container';

// ---------------------------------------------------------------------------
// POST /api/attempts
// ---------------------------------------------------------------------------

/**
 * Submits a SQL attempt for an exercise and returns the evaluation result.
 *
 * Requires: authenticate middleware (req.user must be set), role: student
 * Body: { exercise_id: string, query_sent: string, resolution_time_ms: number }
 * Success:  201 { attempt_id, status, score, resolution_time_ms, hint }
 * Failure:  forwarded to errorHandler (400 EMPTY_QUERY, 404 EXERCISE_NOT_FOUND, etc.)
 */
export async function submitAttempt(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { exercise_id, query_sent, resolution_time_ms } = req.body as {
      exercise_id: string;
      query_sent: string;
      resolution_time_ms: number;
    };

    // req.user is guaranteed to be set by the authenticate middleware
    const userId = req.user!.userId;

    const result = await container.attemptUseCase.submitAttempt(
      userId,
      exercise_id,
      query_sent,
      resolution_time_ms,
    );

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /api/attempts
// ---------------------------------------------------------------------------

/**
 * Returns the authenticated student's attempt history, optionally filtered
 * by a specific exercise.
 *
 * Requires: authenticate middleware (req.user must be set), role: student
 * Query params: exercise_id? (UUID)
 * Success:  200 AttemptHistoryItem[]
 * Failure:  forwarded to errorHandler
 */
export async function getHistory(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { exercise_id } = req.query as { exercise_id?: string };

    // req.user is guaranteed to be set by the authenticate middleware
    const userId = req.user!.userId;

    const history = await container.attemptUseCase.getAttemptHistory(
      userId,
      exercise_id,
    );

    res.status(200).json(history);
  } catch (err) {
    next(err);
  }
}
