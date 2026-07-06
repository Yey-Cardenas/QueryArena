/**
 * Property-Based Tests for ResultUseCase and AttemptUseCase
 * All ports are mocked with jest.fn() — no real database or external services.
 *
 * Requirements covered: 5.1, 5.3, 5.4, 6.1, 6.2, 6.3
 */

import * as fc from 'fast-check';
import { ResultUseCase } from '../../src/domain/use-cases/ResultUseCase';
import { AttemptUseCase } from '../../src/domain/use-cases/AttemptUseCase';
import type { IAttemptRepository } from '../../src/domain/ports/out/IAttemptRepository';
import type { IExerciseRepository } from '../../src/domain/ports/out/IExerciseRepository';
import type { IRankingRepository } from '../../src/domain/ports/out/IRankingRepository';
import type { IResultUseCase } from '../../src/domain/ports/in/IResultUseCase';
import type { Attempt, AttemptStatus } from '../../src/domain/entities/Attempt';
import type { Exercise, Level, Category } from '../../src/domain/entities/Exercise';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAttempt(overrides: Partial<Attempt> = {}): Attempt {
  return {
    id: 'attempt-id-1',
    user_id: 'user-id-1',
    exercise_id: 'exercise-id-1',
    query_sent: 'SELECT * FROM users',
    status: 'incorrect',
    score: 0,
    resolution_time_ms: 1000,
    created_at: new Date('2024-01-01T12:00:00.000Z'),
    ...overrides,
  };
}

function makeLevel(overrides: Partial<Level> = {}): Level {
  return {
    id: 1,
    name: 'Básico',
    created_at: new Date('2024-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 1,
    name: 'SELECT',
    created_at: new Date('2024-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'exercise-id-1',
    title: 'Select all users',
    description: 'Write a query to select all users',
    expected_solution: 'SELECT * FROM users',
    score: 10,
    is_active: true,
    level_id: 1,
    category_id: 1,
    created_at: new Date('2024-01-01T00:00:00.000Z'),
    updated_at: new Date('2024-01-01T00:00:00.000Z'),
    level: makeLevel(),
    category: makeCategory(),
    ...overrides,
  };
}

function makeAttemptRepositoryMock(): jest.Mocked<IAttemptRepository> {
  return {
    create: jest.fn(),
    findByUser: jest.fn(),
    update: jest.fn(),
    countByExercise: jest.fn(),
  };
}

function makeExerciseRepositoryMock(): jest.Mocked<IExerciseRepository> {
  return {
    findAll: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    countByLevel: jest.fn(),
    countByCategory: jest.fn(),
  };
}

function makeRankingRepositoryMock(): jest.Mocked<IRankingRepository> {
  return {
    upsert: jest.fn(),
    findAll: jest.fn(),
    findByUser: jest.fn(),
  };
}

function makeResultUseCaseMock(): jest.Mocked<IResultUseCase> {
  return {
    evaluateAttempt: jest.fn(),
  };
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Generates a valid UUID-like string for test IDs. */
const uuidArb = fc.uuid();

/** Generates a non-empty, non-blank SQL query string. */
const nonBlankQueryArb = fc
  .string({ minLength: 1 })
  .filter((s) => s.trim().length > 0);

/** Generates a positive resolution time in milliseconds. */
const positiveTimeArb = fc.integer({ min: 1, max: 600_000 });

/** Generates a positive exercise score. */
const positiveScoreArb = fc.integer({ min: 1, max: 100 });

/** Generates an AttemptStatus value. */
const attemptStatusArb = fc.constantFrom<AttemptStatus>('correct', 'incorrect', 'error');

/** Generates an incorrect/error status. */
const nonCorrectStatusArb = fc.constantFrom<AttemptStatus>('incorrect', 'error');

// ---------------------------------------------------------------------------
// Property 11: Intento registrado contiene todos los campos requeridos
// Feature: query-arena, Property 11
// Validates: Requirements 5.1, 6.1
// ---------------------------------------------------------------------------

describe('AttemptUseCase — Property-Based Tests', () => {
  it(
    'Property 11: Intento registrado contiene todos los campos requeridos',
    async () => {
      // Feature: query-arena, Property 11
      await fc.assert(
        fc.asyncProperty(
          uuidArb,
          uuidArb,
          nonBlankQueryArb,
          positiveTimeArb,
          uuidArb,
          positiveScoreArb,
          async (userId, exerciseId, querySent, resolutionTimeMs, attemptId, exerciseScore) => {
            const attemptRepository = makeAttemptRepositoryMock();
            const exerciseRepository = makeExerciseRepositoryMock();
            const rankingRepository = makeRankingRepositoryMock();
            const resultUseCase = makeResultUseCaseMock();

            const exercise = makeExercise({ id: exerciseId, score: exerciseScore });
            const persistedAttempt = makeAttempt({
              id: attemptId,
              user_id: userId,
              exercise_id: exerciseId,
              query_sent: querySent,
              status: 'incorrect',
              score: 0,
              resolution_time_ms: resolutionTimeMs,
              created_at: new Date(),
            });

            exerciseRepository.findById.mockResolvedValue(exercise);
            attemptRepository.create.mockResolvedValue(persistedAttempt);
            resultUseCase.evaluateAttempt.mockResolvedValue({
              status: 'incorrect',
              score: 0,
              hint: 'Check your query.',
            });
            rankingRepository.upsert.mockResolvedValue(undefined);

            const useCase = new AttemptUseCase(
              attemptRepository,
              exerciseRepository,
              rankingRepository,
              resultUseCase,
            );

            const result = await useCase.submitAttempt(
              userId,
              exerciseId,
              querySent,
              resolutionTimeMs,
            );

            // The record persisted in the DB must contain all required fields
            const createCall = attemptRepository.create.mock.calls[0][0];

            expect(typeof createCall.user_id).toBe('string');
            expect(createCall.user_id.length).toBeGreaterThan(0);

            expect(typeof createCall.exercise_id).toBe('string');
            expect(createCall.exercise_id.length).toBeGreaterThan(0);

            expect(typeof createCall.query_sent).toBe('string');
            expect(createCall.query_sent.length).toBeGreaterThan(0);

            expect(typeof createCall.status).toBe('string');
            expect(['correct', 'incorrect', 'error']).toContain(createCall.status);

            expect(typeof createCall.score).toBe('number');

            expect(typeof createCall.resolution_time_ms).toBe('number');
            expect(createCall.resolution_time_ms).toBeGreaterThan(0);

            // The returned result must include the attempt_id from the persisted record
            expect(typeof result.attempt_id).toBe('string');
            expect(result.attempt_id).toBe(attemptId);

            // resolution_time_ms must be passed through correctly
            expect(result.resolution_time_ms).toBe(resolutionTimeMs);
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  // ---------------------------------------------------------------------------
  // Property 12: Estado y puntaje del intento son siempre consistentes
  // Feature: query-arena, Property 12
  // Validates: Requirements 5.3, 5.4
  // ---------------------------------------------------------------------------

  it(
    'Property 12: Estado y puntaje del intento son siempre consistentes',
    async () => {
      // Feature: query-arena, Property 12
      await fc.assert(
        fc.asyncProperty(
          uuidArb,
          uuidArb,
          nonBlankQueryArb,
          positiveTimeArb,
          uuidArb,
          positiveScoreArb,
          // Whether this attempt will be evaluated as correct or non-correct
          fc.boolean(),
          async (
            userId,
            exerciseId,
            querySent,
            resolutionTimeMs,
            attemptId,
            exerciseScore,
            isCorrect,
          ) => {
            const attemptRepository = makeAttemptRepositoryMock();
            const exerciseRepository = makeExerciseRepositoryMock();
            const rankingRepository = makeRankingRepositoryMock();
            const resultUseCase = makeResultUseCaseMock();

            const exercise = makeExercise({ id: exerciseId, score: exerciseScore });
            const persistedAttempt = makeAttempt({
              id: attemptId,
              user_id: userId,
              exercise_id: exerciseId,
              query_sent: querySent,
              status: 'incorrect',
              score: 0,
              resolution_time_ms: resolutionTimeMs,
            });

            exerciseRepository.findById.mockResolvedValue(exercise);
            attemptRepository.create.mockResolvedValue(persistedAttempt);

            // ResultUseCase enforces the invariant:
            // correct → score = exerciseScore > 0
            // incorrect/error → score = 0
            const evaluationStatus: AttemptStatus = isCorrect ? 'correct' : 'incorrect';
            const evaluationScore = isCorrect ? exerciseScore : 0;
            const evaluationHint = isCorrect ? null : 'Review your query logic.';

            resultUseCase.evaluateAttempt.mockResolvedValue({
              status: evaluationStatus,
              score: evaluationScore,
              hint: evaluationHint,
            });

            rankingRepository.upsert.mockResolvedValue(undefined);

            const useCase = new AttemptUseCase(
              attemptRepository,
              exerciseRepository,
              rankingRepository,
              resultUseCase,
            );

            const result = await useCase.submitAttempt(
              userId,
              exerciseId,
              querySent,
              resolutionTimeMs,
            );

            // Invariant: status=correct → score > 0; status!=correct → score = 0
            if (result.status === 'correct') {
              expect(result.score).toBeGreaterThan(0);
              expect(result.hint).toBeNull();
            } else {
              expect(result.score).toBe(0);
              // hint must be a non-empty string for non-correct attempts
              expect(result.hint).not.toBeNull();
              expect(typeof result.hint).toBe('string');
              expect((result.hint as string).length).toBeGreaterThan(0);
            }
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  it(
    'Property 12 (ResultUseCase): Estado y puntaje son consistentes en la evaluación directa',
    async () => {
      // Feature: query-arena, Property 12
      // Tests the invariant on ResultUseCase.evaluateAttempt directly, across
      // both syntactically valid and invalid queries.
      await fc.assert(
        fc.asyncProperty(
          uuidArb,
          positiveScoreArb,
          // Pair: (querySent, expectedSolution)
          // We use the same valid query for correct; a different one for incorrect
          fc.record({
            querySent: fc.constantFrom(
              'SELECT * FROM users',
              'SELECT id FROM orders',
              'SELECT FROM table',   // syntax error — SELECT without columns
              '',                    // empty — syntax error
              'NOT SQL AT ALL',      // unrecognised keyword — syntax error
            ),
            expectedSolution: fc.constant('SELECT * FROM users'),
          }),
          async (attemptId, exerciseScore, { querySent, expectedSolution }) => {
            const attemptRepository = makeAttemptRepositoryMock();

            const useCase = new ResultUseCase(attemptRepository);

            // update is called internally — return a plausible Attempt
            attemptRepository.update.mockImplementation(
              async (_id, data) =>
                makeAttempt({ id: _id, status: data.status, score: data.score }),
            );

            const result = await useCase.evaluateAttempt(
              attemptId,
              querySent,
              expectedSolution,
              exerciseScore,
            );

            if (result.status === 'correct') {
              // Invariant: correct → score = exerciseScore > 0
              expect(result.score).toBeGreaterThan(0);
              expect(result.score).toBe(exerciseScore > 0 ? exerciseScore : 1);
              expect(result.hint).toBeNull();
            } else {
              // Invariant: incorrect|error → score = 0
              expect(result.score).toBe(0);
              expect(['incorrect', 'error']).toContain(result.status);
              expect(result.hint).not.toBeNull();
              expect(typeof result.hint).toBe('string');
            }
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  // ---------------------------------------------------------------------------
  // Property 13: Historial de intentos ordenado por fecha descendente
  // Feature: query-arena, Property 13
  // Validates: Requirements 6.2, 6.3
  // ---------------------------------------------------------------------------

  it(
    'Property 13: Historial de intentos está ordenado por fecha descendente',
    async () => {
      // Feature: query-arena, Property 13
      await fc.assert(
        fc.asyncProperty(
          uuidArb,
          // Generate an array of timestamps (as ms since epoch) for the attempts
          fc.array(
            fc.integer({ min: 1_000_000, max: 2_000_000_000 }),
            { minLength: 0, maxLength: 20 },
          ),
          fc.option(uuidArb, { nil: undefined }),
          async (userId, timestampsMs, exerciseIdFilter) => {
            const attemptRepository = makeAttemptRepositoryMock();
            const exerciseRepository = makeExerciseRepositoryMock();
            const rankingRepository = makeRankingRepositoryMock();
            const resultUseCase = makeResultUseCaseMock();

            // Build attempts sorted descending by created_at (as the repository contract requires)
            const sortedTimestamps = [...timestampsMs].sort((a, b) => b - a);
            const attempts: Attempt[] = sortedTimestamps.map((tsMs, i) =>
              makeAttempt({
                id: `attempt-${i}`,
                user_id: userId,
                exercise_id: exerciseIdFilter ?? 'exercise-id-1',
                created_at: new Date(tsMs),
              }),
            );

            attemptRepository.findByUser.mockResolvedValue(attempts);

            const useCase = new AttemptUseCase(
              attemptRepository,
              exerciseRepository,
              rankingRepository,
              resultUseCase,
            );

            const history = await useCase.getAttemptHistory(userId, exerciseIdFilter);

            // The use case must delegate filtering and ordering to the repository
            expect(attemptRepository.findByUser).toHaveBeenCalledWith(userId, exerciseIdFilter);

            // Result length matches input
            expect(history).toHaveLength(attempts.length);

            // Ordering invariant: attempts[i].created_at >= attempts[i+1].created_at
            for (let i = 0; i < history.length - 1; i++) {
              const current = history[i].created_at.getTime();
              const next = history[i + 1].created_at.getTime();
              expect(current).toBeGreaterThanOrEqual(next);
            }
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  it(
    'Property 13 (with exerciseId filter): Historial filtrado por ejercicio también está ordenado',
    async () => {
      // Feature: query-arena, Property 13
      await fc.assert(
        fc.asyncProperty(
          uuidArb,
          uuidArb,
          fc.array(
            fc.integer({ min: 1_000_000, max: 2_000_000_000 }),
            { minLength: 0, maxLength: 20 },
          ),
          async (userId, exerciseId, timestampsMs) => {
            const attemptRepository = makeAttemptRepositoryMock();
            const exerciseRepository = makeExerciseRepositoryMock();
            const rankingRepository = makeRankingRepositoryMock();
            const resultUseCase = makeResultUseCaseMock();

            // Build attempts sorted descending (repository contract)
            const sortedTimestamps = [...timestampsMs].sort((a, b) => b - a);
            const filteredAttempts: Attempt[] = sortedTimestamps.map((tsMs, i) =>
              makeAttempt({
                id: `attempt-filtered-${i}`,
                user_id: userId,
                exercise_id: exerciseId,
                created_at: new Date(tsMs),
              }),
            );

            attemptRepository.findByUser.mockResolvedValue(filteredAttempts);

            const useCase = new AttemptUseCase(
              attemptRepository,
              exerciseRepository,
              rankingRepository,
              resultUseCase,
            );

            const history = await useCase.getAttemptHistory(userId, exerciseId);

            expect(attemptRepository.findByUser).toHaveBeenCalledWith(userId, exerciseId);
            expect(history).toHaveLength(filteredAttempts.length);

            // Ordering invariant holds for filtered results too
            for (let i = 0; i < history.length - 1; i++) {
              const current = history[i].created_at.getTime();
              const next = history[i + 1].created_at.getTime();
              expect(current).toBeGreaterThanOrEqual(next);
            }
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});
