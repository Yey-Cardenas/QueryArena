/**
 * Attempt Routes — Express Router for /api/attempts
 *
 * Mounts the SQL attempt handlers defined in attempt.controller.ts.
 * All routes require a valid JWT (authenticate middleware) and student role.
 *
 * Routes:
 *   POST /api/attempts   → submitAttempt handler  (student only)
 *   GET  /api/attempts   → getHistory handler      (student only)
 *
 * This router is consumed by app.ts:
 *   app.use('/api/attempts', attemptRouter);
 */

import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate';
import { authorize } from '../middlewares/authorize';
import { submitAttempt, getHistory } from '../controllers/attempt.controller';

export const attemptRouter = Router();

// POST /api/attempts — submit a SQL solution for an exercise
attemptRouter.post('/', authenticate, authorize('student'), submitAttempt);

// GET /api/attempts?exercise_id=... — retrieve attempt history
attemptRouter.get('/', authenticate, authorize('student'), getHistory);
