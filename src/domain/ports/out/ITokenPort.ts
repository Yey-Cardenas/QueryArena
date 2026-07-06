/**
 * Output port — ITokenPort
 * Abstraction over a token signing/verification mechanism (e.g., JWT).
 * No external dependencies — pure TypeScript interface.
 */

import type { UserRole } from '../../entities/User';

/** The minimal claims embedded in every issued token. */
export interface TokenPayload {
  userId: string;
  role: UserRole;
}

/** The verified payload, extended with the token's expiration timestamp. */
export interface VerifiedToken extends TokenPayload {
  /** Unix timestamp (seconds) at which the token expires. */
  exp: number;
}

export interface ITokenPort {
  /**
   * Sign a payload and return a token string.
   * The token must include the userId, role and an expiration date.
   */
  sign(payload: TokenPayload): string;

  /**
   * Verify the token's signature and expiration, then return its payload.
   * Must throw when the token is invalid, malformed, or expired.
   */
  verify(token: string): VerifiedToken;
}
