import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import path from 'path';
import { env } from './infrastructure/env';

// Import the DI container so it is wired up at startup.
// Controllers and route handlers (task 14.x) will consume it directly.
import './infrastructure/container';

// ---------------------------------------------------------------------------
// Route imports
// ---------------------------------------------------------------------------
import { authRouter } from './adapters/in/http/routes/auth.routes';
import { userRouter } from './adapters/in/http/routes/user.routes';
import { exerciseRouter } from './adapters/in/http/routes/exercise.routes';
import { attemptRouter } from './adapters/in/http/routes/attempt.routes';
import { rankingRouter } from './adapters/in/http/routes/ranking.routes';
import { dashboardRouter } from './adapters/in/http/routes/dashboard.routes';
import { adminRouter } from './adapters/in/http/routes/admin.routes';

// ---------------------------------------------------------------------------
// Middleware imports
// ---------------------------------------------------------------------------
import { errorHandler } from './adapters/in/http/middlewares/errorHandler';

/**
 * QueryArena — Express application bootstrap.
 *
 * Responsibilities of this file:
 *  1. Create the Express app instance.
 *  2. Register global middleware (body parser, CORS headers).
 *  3. Mount the health-check endpoint.
 *  4. Register the global error handler.
 *  5. Start the HTTP server (only when this file is the entry point).
 *
 * Route groups for each domain feature are wired in task 14.x.
 * The app instance is exported so tests can import it via supertest
 * without triggering app.listen().
 */

export const app = express();

// ---------------------------------------------------------------------------
// Global middleware
// ---------------------------------------------------------------------------

// Parse incoming JSON bodies
app.use(express.json());

// Basic CORS headers — configurable via CORS_ORIGIN env variable.
// In production set CORS_ORIGIN to the frontend domain (e.g. https://queryarena.example.com).
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Access-Control-Allow-Origin', env.CORS_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (_req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

// ---------------------------------------------------------------------------
// Domain routes
// ---------------------------------------------------------------------------
app.use('/api/auth',      authRouter);
app.use('/api/users',     userRouter);
app.use('/api/exercises', exerciseRouter);
app.use('/api/attempts',  attemptRouter);
app.use('/api/ranking',   rankingRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/admin',     adminRouter);

// ---------------------------------------------------------------------------
// Static frontend (production only)
// ---------------------------------------------------------------------------

if (env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist));
  // SPA fallback — return index.html for any non-API route
  app.get(/^(?!\/api).*/, (_req: Request, res: Response) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// ---------------------------------------------------------------------------
// Global error handler (must be registered after all routes)
// ---------------------------------------------------------------------------
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Start server — only when this module is the entry point, not during tests
// ---------------------------------------------------------------------------

if (require.main === module) {
  app.listen(env.PORT, () => {
    console.log(`QueryArena API listening on port ${env.PORT}`);
  });
}
