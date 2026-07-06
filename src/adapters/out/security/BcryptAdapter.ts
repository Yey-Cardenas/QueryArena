/**
 * BcryptAdapter — Output adapter that implements IHashPort using bcrypt.
 *
 * Reads the cost factor from env.BCRYPT_COST (validated at startup to be ≥ 10).
 * No domain dependency: this file lives in the adapters layer and is wired
 * to the domain via infrastructure/container.ts.
 */

import bcrypt from 'bcrypt';
import { IHashPort } from '../../../domain/ports/out/IHashPort';
import { env } from '../../../infrastructure/env';

export class BcryptAdapter implements IHashPort {
  /**
   * Hash a plain-text string using bcrypt with the configured cost factor.
   *
   * @param plain - The plain-text string to hash (e.g., a user password).
   * @returns A bcrypt hash string.
   */
  async hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, env.BCRYPT_COST);
  }

  /**
   * Compare a plain-text string against a previously generated bcrypt hash.
   *
   * @param plain  - The plain-text string to verify.
   * @param hashed - The stored bcrypt hash to compare against.
   * @returns `true` if they match, `false` otherwise.
   */
  async compare(plain: string, hashed: string): Promise<boolean> {
    return bcrypt.compare(plain, hashed);
  }
}
