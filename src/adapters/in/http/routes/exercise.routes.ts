/**
 * Exercise Routes — Express Router for /api/exercises
 *
 * Mounts the exercise catalogue handlers defined in exercise.controller.ts.
 * All routes require a valid JWT (authenticate middleware).
 *
 * Routes:
 *   GET  /api/exercises       → listExercises handler  (student or admin)
 *   GET  /api/exercises/:id   → getExerciseById handler (student or admin)
 *
 * This router is consumed by app.ts:
 *   app.use('/api/exercises', exerciseRouter);
 */

import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate';
import { authorize } from '../middlewares/authorize';
import { listExercises, getExerciseById } from '../controllers/exercise.controller';

export const exerciseRouter = Router();

// GET /api/exercises?level_id=...&category_id=...
exerciseRouter.get('/', authenticate, authorize('student', 'admin'), listExercises);

// GET /api/exercises/:id
exerciseRouter.get('/:id', authenticate, authorize('student', 'admin'), getExerciseById);
