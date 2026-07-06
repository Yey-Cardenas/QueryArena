/**
 * RankingController — HTTP handler for the ranking endpoint.
 *
 * Handlers are plain Express request handlers that:
 *  1. Delegate to the use case via the DI container.
 *  2. Return the appropriate HTTP response on success.
 *  3. Forward any error to the global errorHandler via next(err).
 */

import type { Request, Response, NextFunction } from 'express';
import { container } from '../../../../infrastructure/container';

// ---------------------------------------------------------------------------
// GET /api/ranking
// ---------------------------------------------------------------------------

/**
 * Returns the full global ranking ordered by accumulated_score DESC,
 * with ties broken by last_correct_at ASC.
 *
 * Requires: authenticate middleware (req.user must be set)
 * Accessible to: student and admin roles
 * Success:  200 RankingEntry[]
 * Failure:  forwarded to errorHandler
 */
export async function getRanking(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const ranking = await container.rankingUseCase.getRanking();
    res.status(200).json(ranking);
  } catch (err) {
    next(err);
  }
}
