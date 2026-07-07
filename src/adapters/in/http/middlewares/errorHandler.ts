/**
 * Middleware — errorHandler
 *
 * Centralized Express error handler. Must be registered LAST in the middleware
 * chain (after all routes) so that errors thrown by any handler are caught here.
 *
 * Behavior:
 *   - Domain errors (objects with a `code` field) are mapped to specific HTTP
 *     status codes and returned with the standard error envelope.
 *   - Unknown errors fall back to 500 with a generic message so that internal
 *     details are never leaked to the client.
 *   - 5xx errors are logged at `error` level; 4xx errors at `warn` level.
 *
 * Response shape:
 *   { "error": { "code": "ERROR_CODE", "message": "Human-readable message" } }
 */

import type { Request, Response, NextFunction } from 'express';
import { logger } from '../../../out/logger/WinstonLogger';

// ---------------------------------------------------------------------------
// Domain error code → HTTP status mapping
// ---------------------------------------------------------------------------

// Using Object.create(null) prevents prototype-inherited properties (like
// valueOf, constructor, etc.) from being accidentally matched as error codes.
const STATUS_MAP: Record<string, number> = Object.assign(Object.create(null) as Record<string, number>, {
  // 401
  UNAUTHORIZED: 401,
  INVALID_CREDENTIALS: 401,
  SESSION_EXPIRED: 401,

  // 403
  FORBIDDEN: 403,

  // 404
  NOT_FOUND: 404,
  EXERCISE_NOT_FOUND: 404,
  USER_NOT_FOUND: 404,
  LEVEL_NOT_FOUND: 404,
  CATEGORY_NOT_FOUND: 404,

  // 409
  USERNAME_TAKEN: 409,
  EMAIL_TAKEN: 409,
  NAME_ALREADY_EXISTS: 409,

  // 422
  VALIDATION_ERROR: 422,
  EMPTY_QUERY: 422,
  HAS_ASSOCIATED_EXERCISES: 422,
  HAS_ASSOCIATED_ATTEMPTS: 422,
  INVALID_REFERENCE: 422,
} as Record<string, number>);

// ---------------------------------------------------------------------------
// Type guard — checks whether an unknown value is a domain error
// ---------------------------------------------------------------------------

interface DomainError {
  code: string;
  message?: string;
}

function isDomainError(err: unknown): err is DomainError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    typeof (err as Record<string, unknown>).code === 'string'
  );
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // `next` is required by Express to recognise this as an error-handling
  // middleware even though we never forward errors further.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  const route = `${req.method} ${req.originalUrl}`;

  if (isDomainError(err)) {
    const status = STATUS_MAP[err.code] ?? 500;
    const message = err.message ?? 'An unexpected error occurred.';

    const logMeta = {
      route,
      code: err.code,
      status,
    };

    if (status >= 500) {
      logger.error(`[errorHandler] ${err.code}: ${message}`, logMeta);
    } else {
      logger.warn(`[errorHandler] ${err.code}: ${message}`, logMeta);
    }

    res.status(status).json({
      error: {
        code: err.code,
        message,
      },
    });
    return;
  }

  // Unknown / unhandled error — never expose internals
  const errorMessage =
    err instanceof Error ? err.message : 'An unexpected error occurred.';

  logger.error('[errorHandler] Unhandled error', {
    route,
    error: errorMessage,
    stack: err instanceof Error ? err.stack : undefined,
  });

  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred. Please try again later.',
    },
  });
}
