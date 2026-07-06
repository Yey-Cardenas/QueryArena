/**
 * Unit tests for BcryptAdapter
 * Tests real bcrypt hashing behaviour — no mocks for bcrypt itself.
 * The env module is mocked so env.ts doesn't throw on missing env vars.
 *
 * Validates: Requirements 1.8, 14.4
 */

jest.mock('../../src/infrastructure/env', () => ({
  env: {
    BCRYPT_COST: 10,
    JWT_SECRET: 'test-secret-key',
    JWT_EXPIRES_IN: '1h',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    PORT: 3000,
    NODE_ENV: 'test',
  },
}));

import bcrypt from 'bcrypt';
import { BcryptAdapter } from '../../src/adapters/out/security/BcryptAdapter';

describe('BcryptAdapter', () => {
  let adapter: BcryptAdapter;

  beforeEach(() => {
    adapter = new BcryptAdapter();
  });

  // -------------------------------------------------------------------------
  // hash()
  // -------------------------------------------------------------------------

  describe('hash()', () => {
    it('returns a string', async () => {
      const hash = await adapter.hash('mypassword');
      expect(typeof hash).toBe('string');
    });

    it('produces a hash that bcrypt.compare verifies as true for the same plain text', async () => {
      const plain = 'correcthorsebatterystaple';
      const hash = await adapter.hash(plain);

      const matches = await bcrypt.compare(plain, hash);
      expect(matches).toBe(true);
    });

    it('produces different hashes for different inputs', async () => {
      const hashA = await adapter.hash('passwordA');
      const hashB = await adapter.hash('passwordB');
      expect(hashA).not.toBe(hashB);
    });

    it('produces different hashes for the same input (salted)', async () => {
      const plain = 'samepassword';
      const hash1 = await adapter.hash(plain);
      const hash2 = await adapter.hash(plain);
      // bcrypt salts each hash, so two hashes of the same input are distinct
      expect(hash1).not.toBe(hash2);
    });

    it('generated hash uses a cost factor >= 10', async () => {
      const hash = await adapter.hash('testpassword');
      const rounds = bcrypt.getRounds(hash);
      expect(rounds).toBeGreaterThanOrEqual(10);
    });

    it('generated hash uses exactly the configured cost factor (10)', async () => {
      const hash = await adapter.hash('testpassword');
      const rounds = bcrypt.getRounds(hash);
      expect(rounds).toBe(10);
    });
  });

  // -------------------------------------------------------------------------
  // compare()
  // -------------------------------------------------------------------------

  describe('compare()', () => {
    it('returns true when plain text matches the hash', async () => {
      const plain = 'mySecretPassword';
      const hash = await adapter.hash(plain);

      const result = await adapter.compare(plain, hash);
      expect(result).toBe(true);
    });

    it('returns false when plain text does not match the hash', async () => {
      const plain = 'mySecretPassword';
      const wrongPlain = 'completelywrong';
      const hash = await adapter.hash(plain);

      const result = await adapter.compare(wrongPlain, hash);
      expect(result).toBe(false);
    });

    it('returns false when comparing against a hash of a similar but different string', async () => {
      const hash = await adapter.hash('password123');
      const result = await adapter.compare('password1234', hash);
      expect(result).toBe(false);
    });

    it('is case-sensitive — "Password" does not match hash of "password"', async () => {
      const hash = await adapter.hash('password');
      const result = await adapter.compare('Password', hash);
      expect(result).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // round-trip
  // -------------------------------------------------------------------------

  describe('hash/compare round-trip', () => {
    it('hash then compare produces consistent results for various inputs', async () => {
      const passwords = ['short123', 'a very long password with spaces!', '12345678', 'P@ssw0rd!'];

      for (const password of passwords) {
        const hash = await adapter.hash(password);
        expect(await adapter.compare(password, hash)).toBe(true);
        expect(await adapter.compare(password + 'x', hash)).toBe(false);
      }
    });
  });
});
