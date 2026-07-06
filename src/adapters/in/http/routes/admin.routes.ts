/**
 * Admin Routes — Express Router for /api/admin
 *
 * Mounts CRUD handlers for levels, categories, and exercises.
 * All routes require a valid JWT (authenticate) and admin role (authorize).
 *
 * Routes:
 *   Levels:
 *     POST   /api/admin/levels          → createLevel
 *     GET    /api/admin/levels          → listLevels
 *     PATCH  /api/admin/levels/:id      → updateLevel
 *     DELETE /api/admin/levels/:id      → deleteLevel
 *
 *   Categories:
 *     POST   /api/admin/categories      → createCategory
 *     GET    /api/admin/categories      → listCategories
 *     PATCH  /api/admin/categories/:id  → updateCategory
 *     DELETE /api/admin/categories/:id  → deleteCategory
 *
 *   Exercises:
 *     POST   /api/admin/exercises       → createExercise
 *     GET    /api/admin/exercises       → listExercisesAdmin
 *     PATCH  /api/admin/exercises/:id   → updateExercise
 *     DELETE /api/admin/exercises/:id   → deleteExercise
 *
 * This router is consumed by app.ts:
 *   app.use('/api/admin', adminRouter);
 */

import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate';
import { authorize } from '../middlewares/authorize';
import {
  createLevel,
  listLevels,
  updateLevel,
  deleteLevel,
} from '../controllers/admin.controller';
import {
  createCategory,
  listCategories,
  updateCategory,
  deleteCategory,
} from '../controllers/admin.controller';
import {
  createExercise,
  listExercisesAdmin,
  updateExercise,
  deleteExercise,
} from '../controllers/admin.controller';

export const adminRouter = Router();

// Apply auth + admin guard to all routes in this router
adminRouter.use(authenticate, authorize('admin'));

// ---------------------------------------------------------------------------
// Level routes
// ---------------------------------------------------------------------------
adminRouter.post('/levels',       createLevel);
adminRouter.get('/levels',        listLevels);
adminRouter.patch('/levels/:id',  updateLevel);
adminRouter.delete('/levels/:id', deleteLevel);

// ---------------------------------------------------------------------------
// Category routes
// ---------------------------------------------------------------------------
adminRouter.post('/categories',       createCategory);
adminRouter.get('/categories',        listCategories);
adminRouter.patch('/categories/:id',  updateCategory);
adminRouter.delete('/categories/:id', deleteCategory);

// ---------------------------------------------------------------------------
// Exercise routes
// ---------------------------------------------------------------------------
adminRouter.post('/exercises',       createExercise);
adminRouter.get('/exercises',        listExercisesAdmin);
adminRouter.patch('/exercises/:id',  updateExercise);
adminRouter.delete('/exercises/:id', deleteExercise);
