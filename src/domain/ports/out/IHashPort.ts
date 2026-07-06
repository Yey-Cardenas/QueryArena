/**
 * Output port — IHashPort
 * Abstraction over a one-way hashing mechanism (e.g., bcrypt).
 * No external dependencies — pure TypeScript interface.
 */

export interface IHashPort {
  /**
   * Hash a plain-text string and return the resulting digest.
   * Implementations must use a secure algorithm (bcrypt with cost ≥ 10).
   */
  hash(plain: string): Promise<string>;

  /**
   * Compare a plain-text string against a previously generated hash.
   * Returns true when they match, false otherwise.
   */
  compare(plain: string, hash: string): Promise<boolean>;
}
