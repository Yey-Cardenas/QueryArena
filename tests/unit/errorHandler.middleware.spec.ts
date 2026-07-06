/**
 * Unit + Property-Based tests for the `errorHandler` middleware.
 *
 * The WinstonLogger singleton is mocked so tests run without real logging I/O.
 */

import type { Request, Response, NextFunction } from 'express';
import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// Mock the WinstonLogger module so the singleton `logger` imported by
// errorHandler.ts is a jest mock with controllable spy methods.
// ---------------------------------------------------------------------------

jest.mock('../../src/adapters/out/logger/WinstonLogger', () => {
  const mockLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
  return {
    WinstonLogger: jest.fn(() => mockLogger),
    logger: mockLogger,
  };
});

// Import logger AFTER the mock is in place so we get the mocked singleton.
import { logger } from '../../src/adapters/out/logger/WinstonLogger';
import { errorHandler } from '../../src/adapters/in/http/middlewares/errorHandler';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReq(method = 'GET', url = '/test'): Partial<Request> {
  return {
    method,
    originalUrl: url,
  };
}

function makeRes(): {
  res: Partial<Response>;
  getStatus: () => number | null;
  getBody: () => unknown;
} {
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

// Typed reference to the mocked logger
const mockLogger = logger as unknown as {
  error: jest.Mock;
  warn: jest.Mock;
  info: jest.Mock;
  debug: jest.Mock;
};

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

describe('errorHandler middleware — unit tests', () => {
  beforeEach(() => jest.clearAllMocks());

  it('1. domain error with known code (EXERCISE_NOT_FOUND) → 404 + warn logged with route, code, status', () => {
    const { res, getStatus, getBody } = makeRes();
    const next = makeNext();
    const err = { code: 'EXERCISE_NOT_FOUND', message: 'Exercise not found' };

    errorHandler(err, makeReq('GET', '/exercises/42') as Request, res as Response, next as unknown as NextFunction);

    expect(getStatus()).toBe(404);
    const body = getBody() as { error: { code: string; message: string } };
    expect(body.error.code).toBe('EXERCISE_NOT_FOUND');
    expect(body.error.message).toBe('Exercise not found');

    expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    const [, meta] = mockLogger.warn.mock.calls[0] as [string, Record<string, unknown>];
    expect(meta.route).toBe('GET /exercises/42');
    expect(meta.code).toBe('EXERCISE_NOT_FOUND');
    expect(meta.status).toBe(404);
    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('2. domain error with unknown code → 500 + error logged', () => {
    const { res, getStatus, getBody } = makeRes();
    const next = makeNext();
    const err = { code: 'TOTALLY_UNKNOWN_CODE', message: 'Something weird' };

    errorHandler(err, makeReq('POST', '/api/something') as Request, res as Response, next as unknown as NextFunction);

    expect(getStatus()).toBe(500);
    const body = getBody() as { error: { code: string } };
    expect(body.error.code).toBe('TOTALLY_UNKNOWN_CODE');

    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it('3. Error instance (non-domain) → 500 INTERNAL_SERVER_ERROR + error logged with route, error, stack', () => {
    const { res, getStatus, getBody } = makeRes();
    const next = makeNext();
    const err = new Error('Something went very wrong');

    errorHandler(err, makeReq('DELETE', '/users/1') as Request, res as Response, next as unknown as NextFunction);

    expect(getStatus()).toBe(500);
    const body = getBody() as { error: { code: string; message: string } };
    expect(body.error.code).toBe('INTERNAL_SERVER_ERROR');
    expect(body.error.message).toBe('An unexpected error occurred. Please try again later.');

    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    const [, meta] = mockLogger.error.mock.calls[0] as [string, Record<string, unknown>];
    expect(meta.route).toBe('DELETE /users/1');
    expect(meta.error).toBe('Something went very wrong');
    expect(typeof meta.stack).toBe('string');
  });

  it('4. unknown non-Error string value → 500 INTERNAL_SERVER_ERROR + error logged', () => {
    const { res, getStatus, getBody } = makeRes();
    const next = makeNext();

    errorHandler('something broke', makeReq('GET', '/') as Request, res as Response, next as unknown as NextFunction);

    expect(getStatus()).toBe(500);
    const body = getBody() as { error: { code: string } };
    expect(body.error.code).toBe('INTERNAL_SERVER_ERROR');
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
  });

  it('5. unknown non-Error number value → 500 + error logged', () => {
    const { res, getStatus } = makeRes();
    const next = makeNext();

    errorHandler(42, makeReq('GET', '/') as Request, res as Response, next as unknown as NextFunction);

    expect(getStatus()).toBe(500);
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
  });

  it('6. unknown plain object (no code field) → 500 + error logged', () => {
    const { res, getStatus, getBody } = makeRes();
    const next = makeNext();

    errorHandler({ message: 'no code here' }, makeReq() as Request, res as Response, next as unknown as NextFunction);

    expect(getStatus()).toBe(500);
    const body = getBody() as { error: { code: string } };
    expect(body.error.code).toBe('INTERNAL_SERVER_ERROR');
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
  });

  it('7. client response never contains a stack field (domain error)', () => {
    const { res, getBody } = makeRes();
    const next = makeNext();
    const err = { code: 'FORBIDDEN' };

    errorHandler(err, makeReq() as Request, res as Response, next as unknown as NextFunction);

    const body = getBody() as Record<string, unknown>;
    expect(JSON.stringify(body)).not.toContain('stack');
  });

  it('8. client response never contains a stack field (Error instance)', () => {
    const { res, getBody } = makeRes();
    const next = makeNext();
    const err = new Error('crash');

    errorHandler(err, makeReq() as Request, res as Response, next as unknown as NextFunction);

    const body = getBody() as Record<string, unknown>;
    expect(JSON.stringify(body)).not.toContain('stack');
  });

  it('9. domain error with no message field → uses default message', () => {
    const { res, getBody } = makeRes();
    const next = makeNext();
    const err = { code: 'NOT_FOUND' };

    errorHandler(err, makeReq() as Request, res as Response, next as unknown as NextFunction);

    const body = getBody() as { error: { message: string } };
    expect(body.error.message).toBe('An unexpected error occurred.');
  });
});

// ---------------------------------------------------------------------------
// Property-Based Tests
// ---------------------------------------------------------------------------

describe('errorHandler middleware — Property-Based Tests', () => {
  beforeEach(() => jest.clearAllMocks());

  // Feature: query-arena, Property 22: Logs registran errores con metadatos completos
  // Validates: Requirements 14.1, 14.2, 14.3, 14.4, 14.5, 16.3
  it('Property 22: For any domain error, the logger records route metadata and the client never receives a stack trace', async () => {
    // JS built-in property names that exist on plain objects and would cause
    // STATUS_MAP[code] to return a function rather than undefined.
    const builtInProps = new Set([
      'valueOf', 'toString', 'hasOwnProperty', 'isPrototypeOf',
      'propertyIsEnumerable', 'toLocaleString', 'constructor',
      '__defineGetter__', '__defineSetter__', '__lookupGetter__', '__lookupSetter__',
      '__proto__',
    ]);

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          code: fc.string({ minLength: 1 }).filter((s) => !builtInProps.has(s)),
          message: fc.string(),
        }),
        fc.tuple(
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
        ),
        async (domainError, [method, urlPart]) => {
          jest.clearAllMocks();

          const url = `/${urlPart}`;
          const { res, getStatus, getBody } = makeRes();
          const next = makeNext();

          errorHandler(
            domainError,
            makeReq(method, url) as Request,
            res as Response,
            next as unknown as NextFunction,
          );

          // Either warn (4xx) or error (5xx) must have been called — not neither
          const warnCalled = mockLogger.warn.mock.calls.length > 0;
          const errorCalled = mockLogger.error.mock.calls.length > 0;
          expect(warnCalled || errorCalled).toBe(true);

          // The logger call must include a `route` field matching the request
          const logCalls = warnCalled
            ? mockLogger.warn.mock.calls
            : mockLogger.error.mock.calls;
          const [, meta] = logCalls[0] as [string, Record<string, unknown>];
          expect(typeof meta.route).toBe('string');
          expect((meta.route as string).length).toBeGreaterThan(0);
          expect(meta.route).toBe(`${method} ${url}`);

          // Response status must be a 4xx or 5xx
          const status = getStatus();
          expect(status).not.toBeNull();
          expect(status!).toBeGreaterThanOrEqual(400);
          expect(status!).toBeLessThanOrEqual(599);

          // Client response must NOT include stack trace details
          const body = getBody();
          expect(JSON.stringify(body)).not.toContain('"stack"');
          expect(JSON.stringify(body)).not.toContain('stack');
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: query-arena, Property 22 (complement): For any non-domain error (plain Error),
  // logger.error is called with route + error + stack metadata; client gets 500 INTERNAL_SERVER_ERROR.
  it('Property 22 (non-domain errors): Any plain Error results in 500 with no internal details exposed to client', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),   // error message
        fc.string({ minLength: 1 }),   // method
        fc.string({ minLength: 1 }),   // url part
        async (errorMessage, method, urlPart) => {
          jest.clearAllMocks();

          const url = `/${urlPart}`;
          const err = new Error(errorMessage);
          const { res, getStatus, getBody } = makeRes();
          const next = makeNext();

          errorHandler(
            err,
            makeReq(method, url) as Request,
            res as Response,
            next as unknown as NextFunction,
          );

          // logger.error must have been called
          expect(mockLogger.error).toHaveBeenCalledTimes(1);
          expect(mockLogger.warn).not.toHaveBeenCalled();

          // Metadata must include route, error message, and stack
          const [, meta] = mockLogger.error.mock.calls[0] as [string, Record<string, unknown>];
          expect(meta.route).toBe(`${method} ${url}`);
          expect(meta.error).toBe(errorMessage);
          expect(typeof meta.stack).toBe('string');

          // Client receives 500 with generic code
          expect(getStatus()).toBe(500);
          const body = getBody() as { error: { code: string; message: string } };
          expect(body.error.code).toBe('INTERNAL_SERVER_ERROR');

          // No stack trace in client response
          expect(JSON.stringify(body)).not.toContain('"stack"');
        },
      ),
      { numRuns: 100 },
    );
  });
});
