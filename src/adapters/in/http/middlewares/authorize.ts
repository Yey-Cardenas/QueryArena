/**
 * Middleware — authorize
 *
 * Role-based access control guard. Must be used after `authenticate`.
 *
 * Usage:
 *   router.get('/admin/...', authenticate, authorize('admin'), handler)
 *
 * Behavior:
 *   - `req.user` not set (unauthenticated):  401 { error: { code: 'UNAUTHORIZED', message: '...' } }
 *   - `req.user.role` not in allowed roles:  403 { error: { code: 'FORBIDDEN',     message: '...' } }
 *   - Role is allowed: calls next()
 */

import type { Request, Response, NextFunction } from 'express';
import type { UserRole } from '../../../../domain/entities/User';

/**
 * Factory that returns an Express middleware restricting access to the given roles.
 *
 * @param roles - One or more roles that are permitted to access the route.
 */
export function authorize(...roles: UserRole[]) {
  return function (req: Request, res: Response, next: NextFunction): void {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication is required to access this resource.',
        },
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to access this resource.',
        },
      });
      return;
    }

    next();
  };
}
