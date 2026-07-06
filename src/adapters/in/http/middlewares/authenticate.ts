/**
 * Middleware — authenticate
 *
 * Validates the Bearer JWT sent in the Authorization header.
 * On success, attaches `req.user = { userId, role }` and calls next().
 * On missing/invalid token:  401 { error: { code: 'UNAUTHORIZED',    message: '...' } }
 * On expired token:          401 { error: { code: 'SESSION_EXPIRED', message: '...' } }
 *
 * The JWTAdapter is instantiated once and reused across requests.
 * The Express Request type is extended here to carry the authenticated user.
 */

import type { Request, Response, NextFunction } from 'express';
import type { UserRole } from '../../../../domain/entities/User';
import { JWTAdapter, ExpiredTokenError } from '../../../out/security/JWTAdapter';

// ---------------------------------------------------------------------------
// Extend Express Request to include the authenticated user
// ---------------------------------------------------------------------------

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        role: UserRole;
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton adapter — avoids re-reading env on every request
// ---------------------------------------------------------------------------

const jwtAdapter = new JWTAdapter();

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication token is missing or malformed.',
      },
    });
    return;
  }

  const token = authHeader.slice(7); // strip "Bearer "

  try {
    const payload = jwtAdapter.verify(token);
    req.user = { userId: payload.userId, role: payload.role };
    next();
  } catch (err) {
    if (err instanceof ExpiredTokenError) {
      res.status(401).json({
        error: {
          code: 'SESSION_EXPIRED',
          message: 'Your session has expired. Please log in again.',
        },
      });
      return;
    }

    // InvalidTokenError or any other verification failure
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication token is invalid.',
      },
    });
  }
}
