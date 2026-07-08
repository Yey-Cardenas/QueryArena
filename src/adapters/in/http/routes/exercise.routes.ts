/**
 * Exercise Routes — Express Router for /api/exercises
 *
 * Mounts the exercise catalogue handlers defined in exercise.controller.ts.
 * All routes require a valid JWT (authenticate middleware).
 *
 * Routes:
 *   GET  /api/exercises            → listExercises handler  (student or admin)
 *   GET  /api/exercises/:id        → getExerciseById handler (student or admin)
 *   GET  /api/exercises/levels     → listLevels handler (student or admin)
 *   GET  /api/exercises/categories → listCategories handler (student or admin)
 *
 * This router is consumed by app.ts:
 *   app.use('/api/exercises', exerciseRouter);
 */

import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate';
import { authorize } from '../middlewares/authorize';
import { listExercises, getExerciseById } from '../controllers/exercise.controller';
import { listLevels, listCategories } from '../controllers/admin.controller';

export const exerciseRouter = Router();

// GET /api/exercises/levels — public list of levels (student or admin)
exerciseRouter.get('/levels', authenticate, authorize('student', 'admin'), listLevels);

// GET /api/exercises/categories — public list of categories (student or admin)
exerciseRouter.get('/categories', authenticate, authorize('student', 'admin'), listCategories);

// GET /api/exercises?level_id=...&category_id=...
exerciseRouter.get('/', authenticate, authorize('student', 'admin'), listExercises);

// GET /api/exercises/:id  (must come after static paths to avoid shadowing)
exerciseRouter.get('/:id', authenticate, authorize('student', 'admin'), getExerciseById);
