/**
 * Unit + Property-Based tests for the `authorize` middleware.
 *
 * The middleware is a pure function — no external dependencies to mock.
 */

import type { Request, Response, NextFunction } from 'express';
import type { UserRole } from '../../src/domain/entities/User';
import * as fc from 'fast-check';
import { authorize } from '../../src/adapters/in/http/middlewares/authorize';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReq(user?: { userId: string; role: UserRole }): Partial<Request> {
  return { user };
}

function makeRes(): { res: Partial<Response>; getStatus: () => number | null; getBody: () => unknown } {
  let statusCode: number | null = null;
  let body: unknown = null;

  const res: Partial<Response> = {
    status: jest.fn().mockImplementation((code: number) => {
      statusCode = code;
      return res as Response;
    }),
    json: jest.fn().mockImplementation((b: unknown) => {
      body = b;
      return res as Response;
    }),
  };

  return {
    res,
    getStatus: () => statusCode,
    getBody: () => body,
  };
}

function makeNext(): jest.Mock<void> {
  return jest.fn();
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

describe('authorize middleware — unit tests', () => {
  it('1. no req.user (unauthenticated) → 401 UNAUTHORIZED', () => {
    const { res, getStatus, getBody } = makeRes();
    const next = makeNext();

    authorize('admin')(makeReq(undefined) as Request, res as Response, next as unknown as NextFunction);

    expect(getStatus()).toBe(401);
    expect((getBody() as { error: { code: string } }).error.code).toBe('UNAUTHORIZED');
    expect(next).not.toHaveBeenCalled();
  });

  it('2. student role but route allows only admin → 403 FORBIDDEN', () => {
    const { res, getStatus, getBody } = makeRes();
    const next = makeNext();

    authorize('admin')(
      makeReq({ userId: 'u1', role: 'student' }) as Request,
      res as Response,
      next as unknown as NextFunction,
    );

    expect(getStatus()).toBe(403);
    expect((getBody() as { error: { code: string } }).error.code).toBe('FORBIDDEN');
    expect(next).not.toHaveBeenCalled();
  });

  it('3. admin role but route allows only student → 403 FORBIDDEN', () => {
    const { res, getStatus, getBody } = makeRes();
    const next = makeNext();

    authorize('student')(
      makeReq({ userId: 'u2', role: 'admin' }) as Request,
      res as Response,
      next as unknown as NextFunction,
    );

    expect(getStatus()).toBe(403);
    expect((getBody() as { error: { code: string } }).error.code).toBe('FORBIDDEN');
    expect(next).not.toHaveBeenCalled();
  });

  it('4. student role and route allows student → next() called', () => {
    const { res, getStatus } = makeRes();
    const next = makeNext();

    authorize('student')(
      makeReq({ userId: 'u3', role: 'student' }) as Request,
      res as Response,
      next as unknown as NextFunction,
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(getStatus()).toBeNull();
  });

  it('5. admin role and route allows admin → next() called', () => {
    const { res, getStatus } = makeRes();
    const next = makeNext();

    authorize('admin')(
      makeReq({ userId: 'u4', role: 'admin' }) as Request,
      res as Response,
      next as unknown as NextFunction,
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(getStatus()).toBeNull();
  });

  it('6. route allows both student and admin — student is permitted', () => {
    const { res, getStatus } = makeRes();
    const next = makeNext();

    authorize('student', 'admin')(
      makeReq({ userId: 'u5', role: 'student' }) as Request,
      res as Response,
      next as unknown as NextFunction,
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(getStatus()).toBeNull();
  });

  it('7. route allows both student and admin — admin is permitted', () => {
    const { res, getStatus } = makeRes();
    const next = makeNext();

    authorize('student', 'admin')(
      makeReq({ userId: 'u6', role: 'admin' }) as Request,
      res as Response,
      next as unknown as NextFunction,
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(getStatus()).toBeNull();
  });

  it('8. authorize() with no roles → always 403 for any authenticated user', () => {
    const { res, getStatus, getBody } = makeRes();
    const next = makeNext();

    // An empty allow-list should deny everyone
    (authorize as (...roles: UserRole[]) => ReturnType<typeof authorize>)()(
      makeReq({ userId: 'u7', role: 'admin' }) as Request,
      res as Response,
      next as unknown as NextFunction,
    );

    expect(getStatus()).toBe(403);
    expect((getBody() as { error: { code: string } }).error.code).toBe('FORBIDDEN');
    expect(next).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Property-Based Tests
// ---------------------------------------------------------------------------

describe('authorize middleware — Property-Based Tests', () => {
  const allRoles: UserRole[] = ['student', 'admin'];

  // Feature: query-arena, Property 21: Cross-role → 403
  // Validates: Requirements 14.2, 14.3
  it('Property 21: A request with a role not in the allowed list is rejected with 403 FORBIDDEN', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Pick an allowed-role subset, then pick a user role NOT in that subset
        fc.array(fc.constantFrom<UserRole>(...allRoles), { minLength: 1, maxLength: allRoles.length }),
        fc.constantFrom<UserRole>(...allRoles),
        async (allowedRoles, userRole) => {
          // Only test combinations where the user's role is NOT in the allowed set
          fc.pre(!allowedRoles.includes(userRole));

          const { res, getStatus, getBody } = makeRes();
          const next = makeNext();

          authorize(...allowedRoles)(
            makeReq({ userId: 'user-pbt', role: userRole }) as Request,
            res as Response,
            next as unknown as NextFunction,
          );

          expect(next).not.toHaveBeenCalled();
          expect(getStatus()).toBe(403);
          expect((getBody() as { error: { code: string } }).error.code).toBe('FORBIDDEN');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Property 21 (complement): A request with a role inside the allowed list is permitted', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom<UserRole>(...allRoles),
        async (userRole) => {
          const { res, getStatus } = makeRes();
          const next = makeNext();

          // Authorize exactly that role
          authorize(userRole)(
            makeReq({ userId: 'user-pbt', role: userRole }) as Request,
            res as Response,
            next as unknown as NextFunction,
          );

          expect(next).toHaveBeenCalledTimes(1);
          expect(getStatus()).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Property 21 (unauthenticated): Any request without req.user is rejected with 401', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.constantFrom<UserRole>(...allRoles), { minLength: 1, maxLength: allRoles.length }),
        async (allowedRoles) => {
          const { res, getStatus, getBody } = makeRes();
          const next = makeNext();

          authorize(...allowedRoles)(
            makeReq(undefined) as Request,
            res as Response,
            next as unknown as NextFunction,
          );

          expect(next).not.toHaveBeenCalled();
          expect(getStatus()).toBe(401);
          expect((getBody() as { error: { code: string } }).error.code).toBe('UNAUTHORIZED');
        },
      ),
      { numRuns: 100 },
    );
  });
});
