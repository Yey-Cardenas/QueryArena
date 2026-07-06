/**
 * Output adapter — JWTAdapter
 * Implements ITokenPort using the `jsonwebtoken` package.
 * JWT_SECRET and JWT_EXPIRES_IN are read from env.ts at construction time.
 *
 * Throws typed domain errors on verify failure so callers can map them to
 * the appropriate HTTP response codes (401 UNAUTHORIZED / 401 SESSION_EXPIRED).
 */

import jwt from 'jsonwebtoken';
import type { ITokenPort, TokenPayload, VerifiedToken } from '../../../domain/ports/out/ITokenPort';
import { env } from '../../../infrastructure/env';

/** Error thrown when a token is structurally invalid or its signature does not match. */
export class InvalidTokenError extends Error {
  readonly code = 'UNAUTHORIZED' as const;

  constructor(message = 'Invalid or malformed token') {
    super(message);
    this.name = 'InvalidTokenError';
  }
}

/** Error thrown specifically when a syntactically valid token has expired. */
export class ExpiredTokenError extends Error {
  readonly code = 'SESSION_EXPIRED' as const;

  constructor(message = 'Token has expired') {
    super(message);
    this.name = 'ExpiredTokenError';
  }
}

export class JWTAdapter implements ITokenPort {
  private readonly secret: string;
  private readonly expiresIn: string;

  constructor() {
    this.secret = env.JWT_SECRET;
    this.expiresIn = env.JWT_EXPIRES_IN;
  }

  /**
   * Sign a TokenPayload and return a JWT string.
   * The token includes userId, role, and an expiration claim (exp).
   */
  sign(payload: TokenPayload): string {
    return jwt.sign(
      { userId: payload.userId, role: payload.role },
      this.secret,
      { expiresIn: this.expiresIn } as jwt.SignOptions
    );
  }

  /**
   * Verify the token's signature and expiration.
   * Returns the decoded VerifiedToken on success.
   * Throws ExpiredTokenError when the token is expired.
   * Throws InvalidTokenError for any other failure (bad signature, malformed, etc.).
   */
  verify(token: string): VerifiedToken {
    try {
      const decoded = jwt.verify(token, this.secret) as jwt.JwtPayload;

      // jwt.verify guarantees these fields are present when it succeeds,
      // but we validate defensively to satisfy the VerifiedToken contract.
      if (
        typeof decoded !== 'object' ||
        decoded === null ||
        typeof decoded.userId !== 'string' ||
        typeof decoded.role !== 'string' ||
        typeof decoded.exp !== 'number'
      ) {
        throw new InvalidTokenError('Token payload is missing required claims');
      }

      return {
        userId: decoded.userId as string,
        role: decoded.role as import('../../../domain/entities/User').UserRole,
        exp: decoded.exp,
      };
    } catch (err) {
      if (err instanceof InvalidTokenError || err instanceof ExpiredTokenError) {
        throw err;
      }
      if (err instanceof jwt.TokenExpiredError) {
        throw new ExpiredTokenError();
      }
      // Covers JsonWebTokenError, NotBeforeError, and any other jwt errors
      throw new InvalidTokenError(
        err instanceof Error ? err.message : 'Token verification failed'
      );
    }
  }
}
