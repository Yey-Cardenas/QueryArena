/**
 * Unit + Property-Based tests for the `authenticate` middleware.
 *
 * The JWTAdapter is mocked so tests run without a real JWT secret or
 * environment variables.
 */

import type { Request, Response, NextFunction } from 'express';
import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// Mock env.ts so that importing JWTAdapter (which reads env at module load)
// does not throw due to missing environment variables in test context.
// ---------------------------------------------------------------------------

jest.mock('../../src/infrastructure/env', () => ({
  env: {
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    JWT_SECRET: 'test-secret-for-middleware-tests',
    JWT_EXPIRES_IN: '1h',
    BCRYPT_COST: 10,
    PORT: 3000,
    NODE_ENV: 'test',
  },
}));

// ---------------------------------------------------------------------------
// Mock JWTAdapter before importing the middleware so the singleton picks up
// the mock at construction time.
// ---------------------------------------------------------------------------

import { InvalidTokenError, ExpiredTokenError } from '../../src/adapters/out/security/JWTAdapter';

jest.mock('../../src/adapters/out/security/JWTAdapter', () => {
  const actual = jest.requireActual<typeof import('../../src/adapters/out/security/JWTAdapter')>(
    '../../src/adapters/out/security/JWTAdapter',
  );

  return {
    ...actual,
    JWTAdapter: jest.fn().mockImplementation(() => ({
      verify: mockVerify,
      sign: jest.fn(),
    })),
  };
});

const mockVerify = jest.fn();

// Import middleware AFTER the mock is in place
import { authenticate } from '../../src/adapters/in/http/middlewares/authenticate';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReq(authHeader?: string): Partial<Request> {
  return {
    headers: authHeader ? { authorization: authHeader } : {},
    user: undefined,
  };
}

function makeRes(): { res: Partial<Response>; statusCode: number | null; body: unknown } {
  const store: { statusCode: number | null; body: unknown } = {
    statusCode: null,
    body: null,
  };

  const res: Partial<Response> = {
    status: jest.fn().mockImplementation((code: number) => {
      store.statusCode = code;
      return res as Response;
    }),
    json: jest.fn().mockImplementation((b: unknown) => {
      store.body = b;
      return res as Response;
    }),
  };

  return { res, ...store };
}

function makeNext(): jest.Mock<void> {
  return jest.fn();
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

describe('authenticate middleware — unit tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('1. no Authorization header → 401 UNAUTHORIZED', () => {
    const req = makeReq();
    const { res } = makeRes();
    const next = makeNext();

    authenticate(req as Request, res as Response, next as unknown as NextFunction);

    expect((res.status as jest.Mock).mock.calls[0][0]).toBe(401);
    const body = (res.json as jest.Mock).mock.calls[0][0] as { error: { code: string } };
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(next).not.toHaveBeenCalled();
  });

  it('2. Authorization header without Bearer prefix → 401 UNAUTHORIZED', () => {
    const req = makeReq('Basic sometoken');
    const { res } = makeRes();
    const next = makeNext();

    authenticate(req as Request, res as Response, next as unknown as NextFunction);

    expect((res.status as jest.Mock).mock.calls[0][0]).toBe(401);
    const body = (res.json as jest.Mock).mock.calls[0][0] as { error: { code: string } };
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(next).not.toHaveBeenCalled();
  });

  it('3. valid token → req.user is set and next() is called', () => {
    const payload = { userId: 'user-123', role: 'student' as const, exp: 9999999999 };
    mockVerify.mockReturnValueOnce(payload);

    const req = makeReq('Bearer valid.token.here');
    const { res } = makeRes();
    const next = makeNext();

    authenticate(req as Request, res as Response, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect((req as Request).user).toEqual({ userId: 'user-123', role: 'student' });
    expect(res.status).not.toHaveBeenCalled();
  });

  it('4. valid token with admin role → req.user.role is "admin" and next() is called', () => {
    const payload = { userId: 'admin-456', role: 'admin' as const, exp: 9999999999 };
    mockVerify.mockReturnValueOnce(payload);

    const req = makeReq('Bearer valid.admin.token');
    const { res } = makeRes();
    const next = makeNext();

    authenticate(req as Request, res as Response, next as unknown as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect((req as Request).user).toEqual({ userId: 'admin-456', role: 'admin' });
  });

  it('5. expired token (ExpiredTokenError) → 401 SESSION_EXPIRED, next not called', () => {
    mockVerify.mockImplementationOnce(() => {
      throw new ExpiredTokenError();
    });

    const req = makeReq('Bearer expired.token.here');
    const { res } = makeRes();
    const next = makeNext();

    authenticate(req as Request, res as Response, next as unknown as NextFunction);

    expect((res.status as jest.Mock).mock.calls[0][0]).toBe(401);
    const body = (res.json as jest.Mock).mock.calls[0][0] as { error: { code: string } };
    expect(body.error.code).toBe('SESSION_EXPIRED');
    expect(next).not.toHaveBeenCalled();
  });

  it('6. invalid/tampered token (InvalidTokenError) → 401 UNAUTHORIZED, next not called', () => {
    mockVerify.mockImplementationOnce(() => {
      throw new InvalidTokenError();
    });

    const req = makeReq('Bearer tampered.token.here');
    const { res } = makeRes();
    const next = makeNext();

    authenticate(req as Request, res as Response, next as unknown as NextFunction);

    expect((res.status as jest.Mock).mock.calls[0][0]).toBe(401);
    const body = (res.json as jest.Mock).mock.calls[0][0] as { error: { code: string } };
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(next).not.toHaveBeenCalled();
  });

  it('7. unexpected error from verify → 401 UNAUTHORIZED, next not called', () => {
    mockVerify.mockImplementationOnce(() => {
      throw new Error('Unexpected failure');
    });

    const req = makeReq('Bearer some.token');
    const { res } = makeRes();
    const next = makeNext();

    authenticate(req as Request, res as Response, next as unknown as NextFunction);

    expect((res.status as jest.Mock).mock.calls[0][0]).toBe(401);
    const body = (res.json as jest.Mock).mock.calls[0][0] as { error: { code: string } };
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(next).not.toHaveBeenCalled();
  });

  it('8. "Bearer " with no token string → verify called with empty string → 401 UNAUTHORIZED', () => {
    mockVerify.mockImplementationOnce(() => {
      throw new InvalidTokenError();
    });

    const req = makeReq('Bearer ');
    const { res } = makeRes();
    const next = makeNext();

    authenticate(req as Request, res as Response, next as unknown as NextFunction);

    expect((res.status as jest.Mock).mock.calls[0][0]).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Property-Based Tests
// ---------------------------------------------------------------------------

describe('authenticate middleware — Property-Based Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Feature: query-arena, Property 19: Sin JWT → 401
  // Validates: Requirements 14.1, 14.4
  it('Property 19: Any request without a valid Bearer token is rejected with 401', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate either: no header, malformed header, or empty Bearer
        fc.oneof(
          fc.constant(undefined),
          fc.string().filter((s) => !s.startsWith('Bearer ')),
          fc.constant('Bearer'),
          fc.constant('bearer valid.token'),  // wrong casing
        ),
        async (authHeader) => {
          jest.clearAllMocks();

          // Even if verify were called, it would throw to simulate an invalid token.
          mockVerify.mockImplementation(() => {
            throw new InvalidTokenError();
          });

          const req = makeReq(authHeader);
          const { res } = makeRes();
          const next = makeNext();

          authenticate(req as Request, res as Response, next as unknown as NextFunction);

          expect(next).not.toHaveBeenCalled();
          expect((res.status as jest.Mock).mock.calls[0][0]).toBe(401);
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: query-arena, Property 20: JWT adulterado → 401
  // Validates: Requirements 14.5
  it('Property 20: Any token that fails verification is rejected with 401 UNAUTHORIZED', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        async (token) => {
          jest.clearAllMocks();

          mockVerify.mockImplementation(() => {
            throw new InvalidTokenError('Signature verification failed');
          });

          const req = makeReq(`Bearer ${token}`);
          const { res } = makeRes();
          const next = makeNext();

          authenticate(req as Request, res as Response, next as unknown as NextFunction);

          expect(next).not.toHaveBeenCalled();
          expect((res.status as jest.Mock).mock.calls[0][0]).toBe(401);
          const body = (res.json as jest.Mock).mock.calls[0][0] as { error: { code: string } };
          expect(body.error.code).toBe('UNAUTHORIZED');
        },
      ),
      { numRuns: 100 },
    );
  });
});
