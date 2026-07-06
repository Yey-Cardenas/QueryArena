/**
 * Dashboard Routes — Express Router for /api/dashboard
 *
 * Mounts the student progress dashboard handlers defined in dashboard.controller.ts.
 * All routes require a valid JWT (authenticate middleware) and student role.
 *
 * Routes:
 *   GET /api/dashboard/summary            → getSummary handler         (student only)
 *   GET /api/dashboard/progress/level     → getProgressByLevel handler (student only)
 *   GET /api/dashboard/progress/category  → getProgressByCategory handler (student only)
 *   GET /api/dashboard/history            → getRecentHistory handler   (student only)
 *
 * This router is consumed by app.ts:
 *   app.use('/api/dashboard', dashboardRouter);
 */

import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate';
import { authorize } from '../middlewares/authorize';
import {
  getSummary,
  getProgressByLevel,
  getProgressByCategory,
  getRecentHistory,
} from '../controllers/dashboard.controller';

export const dashboardRouter = Router();

// GET /api/dashboard/summary — top-level student dashboard summary
dashboardRouter.get('/summary', authenticate, authorize('student'), getSummary);

// GET /api/dashboard/progress/level — per-level progress counters
dashboardRouter.get('/progress/level', authenticate, authorize('student'), getProgressByLevel);

// GET /api/dashboard/progress/category — per-category progress counters
dashboardRouter.get('/progress/category', authenticate, authorize('student'), getProgressByCategory);

// GET /api/dashboard/history — 10 most recent attempts
dashboardRouter.get('/history', authenticate, authorize('student'), getRecentHistory);
