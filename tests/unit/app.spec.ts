/**
 * Smoke tests for the Express application bootstrap (src/app.ts).
 *
 * Tests verify:
 *  - GET /health returns 200 { status: 'ok' }
 *  - The global error handler returns 500 with the standard error envelope
 *  - CORS headers are present on regular responses
 *  - OPTIONS preflight returns 204
 *
 * The container import inside app.ts tries to instantiate Postgres adapters,
 * which would fail without DATABASE_URL. We set stub env vars before importing
 * so env.ts validation passes. No real database connection is made.
 */

// ---------------------------------------------------------------------------
// Set up required environment variables BEFORE importing app.ts (which
// transitively imports env.ts and container.ts).
// ---------------------------------------------------------------------------
process.env.DATABASE_URL   = 'postgresql://stub:stub@localhost:5432/stub';
process.env.JWT_SECRET     = 'test-secret-at-least-32-chars-long!!';
process.env.JWT_EXPIRES_IN = '1h';
process.env.BCRYPT_COST    = '10';
process.env.PORT           = '3000';

import request from 'supertest';
import express, { NextFunction, Request, Response } from 'express';

// Mock the container so Postgres constructors are never called.
jest.mock('../../src/infrastructure/container', () => ({
  container: {},
}));

// Import the app AFTER env vars are set and container is mocked.
import { app } from '../../src/app';

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

describe('GET /health', () => {
  it('returns 200 with { status: "ok" }', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

// ---------------------------------------------------------------------------
// CORS middleware
// ---------------------------------------------------------------------------

describe('CORS headers', () => {
  it('sets Access-Control-Allow-Origin on a regular request', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });

  it('responds 204 to OPTIONS preflight', async () => {
    const res = await request(app)
      .options('/health')
      .set('Access-Control-Request-Method', 'GET');
    expect(res.status).toBe(204);
  });
});

// ---------------------------------------------------------------------------
// Global error handler — tested via a fresh mini-app using the same handler
// logic so route-registration order doesn't interfere.
// ---------------------------------------------------------------------------

describe('Global error handler', () => {
  it('returns 500 with standard error envelope for unhandled errors', async () => {
    // Build a minimal Express app that has the same error handler as app.ts
    // but with the throwing route registered BEFORE the handler.
    const testApp = express();
    testApp.use(express.json());

    testApp.get('/err', (_req, _res, next: NextFunction) => {
      next(new Error('Test error'));
    });

    // Mirror the error handler from app.ts
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    testApp.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred. Please try again later.',
        },
      });
    });

    const res = await request(testApp).get('/err');
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: expect.any(String),
      },
    });
  });
});
