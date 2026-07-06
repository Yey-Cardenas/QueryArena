/**
 * User Routes — Express Router for /api/users
 *
 * Mounts the user profile handlers defined in user.controller.ts.
 * All routes require a valid JWT (authenticate middleware).
 *
 * Routes:
 *   GET   /api/users/me  → getProfile handler
 *   PATCH /api/users/me  → updateProfile handler
 *
 * This router is consumed by app.ts:
 *   app.use('/api/users', userRouter);
 */

import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate';
import { getProfile, updateProfile } from '../controllers/user.controller';

export const userRouter = Router();

// GET /api/users/me
userRouter.get('/me', authenticate, getProfile);

// PATCH /api/users/me
userRouter.patch('/me', authenticate, updateProfile);
