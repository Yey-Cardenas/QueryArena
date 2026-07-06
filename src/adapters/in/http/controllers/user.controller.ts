/**
 * UserController — HTTP handlers for user profile endpoints.
 *
 * Handlers are plain Express request handlers that:
 *  1. Extract the authenticated user ID from req.user (set by authenticate middleware).
 *  2. Delegate to the use case via the DI container.
 *  3. Return the appropriate HTTP response on success.
 *  4. Forward any error to the global errorHandler via next(err).
 */

import type { Request, Response, NextFunction } from 'express';
import { container } from '../../../../infrastructure/container';

// ---------------------------------------------------------------------------
// GET /api/users/me
// ---------------------------------------------------------------------------

/**
 * Returns the profile of the currently authenticated user.
 *
 * Requires: authenticate middleware (req.user must be set)
 * Success:  200 { username, email, created_at, role }
 * Failure:  forwarded to errorHandler (404 USER_NOT_FOUND, etc.)
 */
export async function getProfile(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const profile = await container.userUseCase.getProfile(userId);
    res.status(200).json(profile);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/users/me
// ---------------------------------------------------------------------------

/**
 * Updates allowed profile fields (username and/or email) for the authenticated user.
 *
 * Requires: authenticate middleware (req.user must be set)
 * Request body: { username?: string, email?: string }
 * Success:      200 { username, email, created_at, role }
 * Failure:      forwarded to errorHandler (409 USERNAME_TAKEN / EMAIL_TAKEN, etc.)
 */
export async function updateProfile(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const { username, email } = req.body as {
      username?: string;
      email?: string;
    };

    const updated = await container.userUseCase.updateProfile(userId, { username, email });
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
}
