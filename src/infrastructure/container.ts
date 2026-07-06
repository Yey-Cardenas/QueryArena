/**
 * container.ts — Manual dependency injection wiring.
 *
 * This module is the single place where output adapters are instantiated and
 * injected into use cases.  No DI framework is used — pure constructor
 * injection following the hexagonal architecture contract.
 *
 * Rule: only `infrastructure/` files (and `app.ts`) may import from this
 * module.  Domain use-case files must never import from here.
 */

// ---------------------------------------------------------------------------
// Output adapters — security
// ---------------------------------------------------------------------------
import { BcryptAdapter } from '../adapters/out/security/BcryptAdapter';
import { JWTAdapter } from '../adapters/out/security/JWTAdapter';

// ---------------------------------------------------------------------------
// Output adapters — persistence
// ---------------------------------------------------------------------------
import { PostgresUserRepository } from '../adapters/out/persistence/postgres/PostgresUserRepository';
import { PostgresExerciseRepository } from '../adapters/out/persistence/postgres/PostgresExerciseRepository';
import { PostgresAttemptRepository } from '../adapters/out/persistence/postgres/PostgresAttemptRepository';
import { PostgresRankingRepository } from '../adapters/out/persistence/postgres/PostgresRankingRepository';
import { PostgresLevelRepository } from '../adapters/out/persistence/postgres/PostgresLevelRepository';
import { PostgresCategoryRepository } from '../adapters/out/persistence/postgres/PostgresCategoryRepository';

// ---------------------------------------------------------------------------
// Output adapters — logging
// ---------------------------------------------------------------------------
import { WinstonLogger } from '../adapters/out/logger/WinstonLogger';

// ---------------------------------------------------------------------------
// Use cases
// ---------------------------------------------------------------------------
import { AuthUseCase } from '../domain/use-cases/AuthUseCase';
import { UserUseCase } from '../domain/use-cases/UserUseCase';
import { ExerciseUseCase } from '../domain/use-cases/ExerciseUseCase';
import { ResultUseCase } from '../domain/use-cases/ResultUseCase';
import { AttemptUseCase } from '../domain/use-cases/AttemptUseCase';
import { RankingUseCase } from '../domain/use-cases/RankingUseCase';
import { DashboardUseCase } from '../domain/use-cases/DashboardUseCase';
import { AdminUseCase } from '../domain/use-cases/AdminUseCase';

// ---------------------------------------------------------------------------
// Adapter instantiation (singletons — one instance shared across the app)
// ---------------------------------------------------------------------------

const bcryptAdapter = new BcryptAdapter();
const jwtAdapter = new JWTAdapter();

const userRepository = new PostgresUserRepository();
const exerciseRepository = new PostgresExerciseRepository();
const attemptRepository = new PostgresAttemptRepository();
const rankingRepository = new PostgresRankingRepository();
const levelRepository = new PostgresLevelRepository();
const categoryRepository = new PostgresCategoryRepository();

const logger = new WinstonLogger();

// ---------------------------------------------------------------------------
// Use-case wiring
// ---------------------------------------------------------------------------

const authUseCase = new AuthUseCase(userRepository, bcryptAdapter, jwtAdapter);

const userUseCase = new UserUseCase(userRepository);

const exerciseUseCase = new ExerciseUseCase(exerciseRepository);

const resultUseCase = new ResultUseCase(attemptRepository);

const attemptUseCase = new AttemptUseCase(
  attemptRepository,
  exerciseRepository,
  rankingRepository,
  resultUseCase,
);

// RankingUseCase expects a logger with the signature (msg: string, ...args: unknown[]) => void.
// WinstonLogger uses (message: string, meta?: Record<string, unknown>) => void.
// Bridge the two shapes here so neither interface needs to change.
const rankingLogger = {
  error: (msg: string, ...args: unknown[]): void => {
    const meta = args.length > 0 && typeof args[0] === 'object' && args[0] !== null
      ? (args[0] as Record<string, unknown>)
      : undefined;
    logger.error(msg, meta);
  },
};

const rankingUseCase = new RankingUseCase(rankingRepository, rankingLogger);

const dashboardUseCase = new DashboardUseCase(
  attemptRepository,
  exerciseRepository,
  rankingRepository,
);

const adminUseCase = new AdminUseCase(
  levelRepository,
  categoryRepository,
  exerciseRepository,
  attemptRepository,
);

// ---------------------------------------------------------------------------
// Public container object
// ---------------------------------------------------------------------------

/**
 * Singleton container exported for consumption by Express controllers and
 * route setup.  Import named use cases directly; do not spread or destructure
 * the whole container in unrelated modules.
 *
 * @example
 * import { container } from '../infrastructure/container';
 * const token = await container.authUseCase.login(email, password);
 */
export const container = {
  authUseCase,
  userUseCase,
  exerciseUseCase,
  resultUseCase,
  attemptUseCase,
  rankingUseCase,
  dashboardUseCase,
  adminUseCase,
} as const;
