/**
 * Ranking Routes — Express Router for /api/ranking
 *
 * Mounts the ranking handler defined in ranking.controller.ts.
 * The GET route requires a valid JWT (authenticate middleware) and is
 * accessible to both student and admin roles.
 *
 * Routes:
 *   GET /api/ranking → getRanking handler  (student + admin)
 *
 * This router is consumed by app.ts:
 *   app.use('/api/ranking', rankingRouter);
 */

import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate';
import { getRanking } from '../controllers/ranking.controller';

export const rankingRouter = Router();

// GET /api/ranking — retrieve the full global ranking
rankingRouter.get('/', authenticate, getRanking);
