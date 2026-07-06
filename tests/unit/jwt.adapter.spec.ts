/**
 * Unit tests for JWTAdapter
 * Tests real JWT signing and verification behaviour.
 * The env module is mocked so env.ts doesn't throw on missing env vars.
 *
 * Validates: Requirements 2.6, 14.5
 */

jest.mock('../../src/infrastructure/env', () => ({
  env: {
    BCRYPT_COST: 10,
    JWT_SECRET: 'test-secret-key-for-unit-tests',
    JWT_EXPIRES_IN: '1h',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    PORT: 3000,
    NODE_ENV: 'test',
  },
}));

import jwt from 'jsonwebtoken';
import { JWTAdapter, InvalidTokenError, ExpiredTokenError } from '../../src/adapters/out/security/JWTAdapter';

const TEST_SECRET = 'test-secret-key-for-unit-tests';

describe('JWTAdapter', () => {
  let adapter: JWTAdapter;

  beforeEach(() => {
    adapter = new JWTAdapter();
  });

  // -------------------------------------------------------------------------
  // sign()
  // -------------------------------------------------------------------------

  describe('sign()', () => {
    it('returns a non-empty string', () => {
      const token = adapter.sign({ userId: 'user-1', role: 'student' });
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });

    it('returns a string with three dot-separated segments (JWT format)', () => {
      const token = adapter.sign({ userId: 'user-1', role: 'student' });
      const parts = token.split('.');
      expect(parts).toHaveLength(3);
    });

    it('signed JWT contains userId claim matching the input', () => {
      const userId = 'user-abc-123';
      const token = adapter.sign({ userId, role: 'student' });
      const decoded = jwt.decode(token) as jwt.JwtPayload;
      expect(decoded.userId).toBe(userId);
    });

    it('signed JWT contains role claim matching the input', () => {
      const token = adapter.sign({ userId: 'user-1', role: 'admin' });
      const decoded = jwt.decode(token) as jwt.JwtPayload;
      expect(decoded.role).toBe('admin');
    });

    it('signed JWT contains an exp claim', () => {
      const token = adapter.sign({ userId: 'user-1', role: 'student' });
      const decoded = jwt.decode(token) as jwt.JwtPayload;
      expect(typeof decoded.exp).toBe('number');
    });

    it('exp claim is in the future for a 1h token', () => {
      const token = adapter.sign({ userId: 'user-1', role: 'student' });
      const decoded = jwt.decode(token) as jwt.JwtPayload;
      expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });
  });

  // -------------------------------------------------------------------------
  // verify() — valid token
  // -------------------------------------------------------------------------

  describe('verify() — valid token', () => {
    it('returns a VerifiedToken with the correct userId', () => {
      const userId = 'user-xyz-789';
      const token = adapter.sign({ userId, role: 'student' });
      const result = adapter.verify(token);
      expect(result.userId).toBe(userId);
    });

    it('returns a VerifiedToken with the correct role', () => {
      const token = adapter.sign({ userId: 'user-1', role: 'admin' });
      const result = adapter.verify(token);
      expect(result.role).toBe('admin');
    });

    it('returns a VerifiedToken with a numeric exp field', () => {
      const token = adapter.sign({ userId: 'user-1', role: 'student' });
      const result = adapter.verify(token);
      expect(typeof result.exp).toBe('number');
    });

    it('sign → verify round-trip preserves userId and role', () => {
      const payload = { userId: 'roundtrip-user', role: 'admin' as const };
      const token = adapter.sign(payload);
      const verified = adapter.verify(token);

      expect(verified.userId).toBe(payload.userId);
      expect(verified.role).toBe(payload.role);
    });
  });

  // -------------------------------------------------------------------------
  // verify() — expired token
  // -------------------------------------------------------------------------

  describe('verify() — expired token', () => {
    it('throws ExpiredTokenError for an already-expired token', () => {
      // Sign with -1 seconds expiry so it is expired immediately
      const expiredToken = jwt.sign(
        { userId: 'user-1', role: 'student' },
        TEST_SECRET,
        { expiresIn: -1 } as jwt.SignOptions,
      );

      expect(() => adapter.verify(expiredToken)).toThrow(ExpiredTokenError);
    });

    it('ExpiredTokenError has code === "SESSION_EXPIRED"', () => {
      const expiredToken = jwt.sign(
        { userId: 'user-1', role: 'student' },
        TEST_SECRET,
        { expiresIn: -1 } as jwt.SignOptions,
      );

      try {
        adapter.verify(expiredToken);
        fail('expected ExpiredTokenError to be thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ExpiredTokenError);
        expect((err as ExpiredTokenError).code).toBe('SESSION_EXPIRED');
      }
    });
  });

  // -------------------------------------------------------------------------
  // verify() — tampered / invalid tokens
  // -------------------------------------------------------------------------

  describe('verify() — tampered token', () => {
    it('throws InvalidTokenError when the payload is tampered', () => {
      const token = adapter.sign({ userId: 'user-1', role: 'student' });
      const [header, , signature] = token.split('.');

      // Tamper the payload: change userId to a different value
      const tamperedPayload = Buffer.from(
        JSON.stringify({ userId: 'evil-user', role: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 }),
      ).toString('base64url');

      const tamperedToken = `${header}.${tamperedPayload}.${signature}`;

      expect(() => adapter.verify(tamperedToken)).toThrow(InvalidTokenError);
    });

    it('InvalidTokenError from tampered token has code === "UNAUTHORIZED"', () => {
      const token = adapter.sign({ userId: 'user-1', role: 'student' });
      const [header, , signature] = token.split('.');
      const tamperedPayload = Buffer.from(
        JSON.stringify({ userId: 'hacker', role: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 }),
      ).toString('base64url');
      const tamperedToken = `${header}.${tamperedPayload}.${signature}`;

      try {
        adapter.verify(tamperedToken);
        fail('expected InvalidTokenError to be thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(InvalidTokenError);
        expect((err as InvalidTokenError).code).toBe('UNAUTHORIZED');
      }
    });
  });

  describe('verify() — malformed token', () => {
    it('throws InvalidTokenError for a random string', () => {
      expect(() => adapter.verify('not-a-jwt-at-all')).toThrow(InvalidTokenError);
    });

    it('throws InvalidTokenError for an empty string', () => {
      expect(() => adapter.verify('')).toThrow(InvalidTokenError);
    });

    it('throws InvalidTokenError for a token signed with a different secret', () => {
      const wrongSecretToken = jwt.sign(
        { userId: 'user-1', role: 'student' },
        'completely-different-secret',
        { expiresIn: '1h' },
      );

      expect(() => adapter.verify(wrongSecretToken)).toThrow(InvalidTokenError);
    });

    it('InvalidTokenError from malformed input has code === "UNAUTHORIZED"', () => {
      try {
        adapter.verify('garbage.input.here');
        fail('expected InvalidTokenError to be thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(InvalidTokenError);
        expect((err as InvalidTokenError).code).toBe('UNAUTHORIZED');
      }
    });
  });

  // -------------------------------------------------------------------------
  // Error class contracts
  // -------------------------------------------------------------------------

  describe('error classes', () => {
    it('InvalidTokenError has name "InvalidTokenError"', () => {
      const err = new InvalidTokenError();
      expect(err.name).toBe('InvalidTokenError');
      expect(err.code).toBe('UNAUTHORIZED');
    });

    it('ExpiredTokenError has name "ExpiredTokenError"', () => {
      const err = new ExpiredTokenError();
      expect(err.name).toBe('ExpiredTokenError');
      expect(err.code).toBe('SESSION_EXPIRED');
    });
  });
});
