/**
 * AuthController — HTTP handlers for authentication endpoints.
 *
 * Handlers are plain Express request handlers that:
 *  1. Extract body parameters from the request.
 *  2. Delegate to the use case via the DI container.
 *  3. Return the appropriate HTTP response on success.
 *  4. Forward any error to the global errorHandler via next(err).
 */

import type { Request, Response, NextFunction } from 'express';
import { container } from '../../../../infrastructure/container';

// ---------------------------------------------------------------------------
// POST /api/auth/register
// ---------------------------------------------------------------------------

/**
 * Registers a new user with role 'student'.
 *
 * Request body: { username: string, email: string, password: string }
 * Success:      201 { message: "User created successfully" }
 * Failure:      forwarded to errorHandler (409 USERNAME_TAKEN / EMAIL_TAKEN,
 *               422 VALIDATION_ERROR, etc.)
 */
export async function register(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { username, email, password } = req.body as {
      username: unknown;
      email: unknown;
      password: unknown;
    };

    const result = await container.authUseCase.register(
      username as string,
      email as string,
      password as string,
    );

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------

/**
 * Authenticates an existing user and returns a signed JWT.
 *
 * Request body: { email: string, password: string }
 * Success:      200 { token: string, user: { id, username, role } }
 * Failure:      forwarded to errorHandler (401 INVALID_CREDENTIALS, etc.)
 */
export async function login(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { email, password } = req.body as {
      email: unknown;
      password: unknown;
    };

    const result = await container.authUseCase.login(
      email as string,
      password as string,
    );

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
