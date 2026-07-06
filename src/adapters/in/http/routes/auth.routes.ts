/**
 * Auth Routes — Express Router for /api/auth
 *
 * Mounts the authentication handlers defined in auth.controller.ts.
 * No JWT middleware is required for these routes (public endpoints).
 *
 * Routes:
 *   POST /api/auth/register  → register handler
 *   POST /api/auth/login     → login handler
 *
 * This router is consumed by app.ts:
 *   app.use('/api/auth', authRouter);
 */

import { Router } from 'express';
import { register, login } from '../controllers/auth.controller';

export const authRouter = Router();

// POST /api/auth/register
authRouter.post('/register', register);

// POST /api/auth/login
authRouter.post('/login', login);
