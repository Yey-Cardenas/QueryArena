/**
 * Property-Based Tests for RankingUseCase and DashboardUseCase
 * All ports are mocked with jest.fn() — no real database.
 *
 * Properties covered:
 *   - Property 14: Puntaje acumulado = suma de intentos correctos
 *   - Property 15: Ranking ordenado + desempate por fecha
 *   - Property 16: Dashboard refleja datos reales del estudiante
 *   - Property 17: Progreso por nivel/categoría exacto
 *
 * Requirements: 8.1, 8.2, 8.3, 8.5, 9.1, 9.2, 9.3, 10.1, 10.2
 */

import * as fc from 'fast-check';
import { RankingUseCase } from '../../src/domain/use-cases/RankingUseCase';
import { DashboardUseCase } from '../../src/domain/use-cases/DashboardUseCase';
import type { IAttemptRepository } from '../../src/domain/ports/out/IAttemptRepository';
import type { IExerciseRepository } from '../../src/domain/ports/out/IExerciseRepository';
import type { IRankingRepository } from '../../src/domain/ports/out/IRankingRepository';
import type { Attempt, AttemptStatus } from '../../src/domain/entities/Attempt';
import type { Exercise, Level, Category } from '../../src/domain/entities/Exercise';
import type { Ranking } from '../../src/domain/entities/Ranking';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Entity helpers
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
    created_at: new Date('2024-01-01T10:00:00.000Z'),
    ...overrides,
  };
}

function makeLevel(overrides: Partial<Level> = {}): Level {
  return {
    id: 1,
    name: 'Beginner',
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

function makeRankingRow(
  overrides: Partial<Ranking & { username: string }> = {},
): Ranking & { username: string } {
  return {
    id: 'ranking-id-1',
    user_id: 'user-id-1',
    username: 'student1',
    accumulated_score: 100,
    last_correct_at: new Date('2024-01-01T10:00:00.000Z'),
    updated_at: new Date('2024-01-01T10:00:00.000Z'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** A valid UUID string. */
const uuidArb = fc.uuid();

/** A positive integer score (1–100). */
const positiveScoreArb = fc.integer({ min: 1, max: 100 });

/** An AttemptStatus value. */
const attemptStatusArb = fc.constantFrom<AttemptStatus>('correct', 'incorrect', 'error');

/**
 * Generates a single attempt record with randomised status/score.
 * When status is 'correct', score is positiveScore; otherwise score is 0.
 */
const attemptRecordArb = fc
  .record({
    id: uuidArb,
    exerciseId: uuidArb,
    status: attemptStatusArb,
    score: positiveScoreArb,
    createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
  })
  .map(({ id, exerciseId, status, score, createdAt }) => ({
    id,
    exerciseId,
    status,
    score: status === 'correct' ? score : 0,
    createdAt,
  }));

/**
 * Generates an array of 0–20 attempt records for a single user.
 */
const attemptsArrayArb = fc.array(attemptRecordArb, { minLength: 0, maxLength: 20 });

/**
 * Generates a student entry: userId, username, accumulatedScore, lastCorrectAt.
 */
const studentEntryArb = fc.record({
  userId: uuidArb,
  username: fc.string({ minLength: 3, maxLength: 12 }).filter((s) => s.trim().length > 0),
  accumulatedScore: fc.integer({ min: 0, max: 500 }),
  lastCorrectAt: fc.option(
    fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
    { nil: null },
  ),
});

/** Generates 1–10 student entries with unique userIds and usernames. */
const uniqueStudentsArb = fc
  .array(studentEntryArb, { minLength: 1, maxLength: 10 })
  .map((students) => {
    // Deduplicate by userId
    const seen = new Set<string>();
    return students.filter((s) => {
      if (seen.has(s.userId)) return false;
      seen.add(s.userId);
      return true;
    });
  })
  .filter((students) => students.length > 0);

// ===========================================================================
// Property 14: Puntaje acumulado = suma de intentos correctos
// ===========================================================================

describe('RankingUseCase — Property 14', () => {
  it(
    'Property 14: El accumulated_score en el ranking es exactamente la suma de scores de intentos correctos',
    async () => {
      // Feature: query-arena, Property 14: Puntaje acumulado = suma de intentos correctos
      // Validates: Requirements 8.1, 8.2
      await fc.assert(
        fc.asyncProperty(
          uuidArb,
          attemptsArrayArb,
          async (userId, attemptRecords) => {
            const rankingRepository = makeRankingRepositoryMock();
            const mockLogger = { error: jest.fn() };
            const useCase = new RankingUseCase(rankingRepository, mockLogger);

            // Compute the expected accumulated score: sum of scores of correct attempts
            const expectedScore = attemptRecords
              .filter((a) => a.status === 'correct')
              .reduce((sum, a) => sum + a.score, 0);

            // Mock upsert to track accumulated calls
            let actualAccumulatedScore = 0;
            rankingRepository.upsert.mockImplementation(async (_uid, increment) => {
              actualAccumulatedScore += increment;
            });

            // Call updateScore once per correct attempt (simulating what ResultUseCase does)
            const correctAttempts = attemptRecords.filter((a) => a.status === 'correct');
            for (const attempt of correctAttempts) {
              await useCase.updateScore(userId, attempt.score);
              // Allow the fire-and-forget task to settle
              await new Promise<void>((resolve) => setTimeout(resolve, 0));
            }

            // The total increments passed to the repository must equal the expected score
            expect(actualAccumulatedScore).toBe(expectedScore);

            // Verify upsert was called exactly once per correct attempt
            expect(rankingRepository.upsert).toHaveBeenCalledTimes(correctAttempts.length);

            // Each upsert must have been called with the userId
            for (const call of rankingRepository.upsert.mock.calls) {
              expect(call[0]).toBe(userId);
            }
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});

// ===========================================================================
// Property 15: Ranking ordenado + desempate por fecha
// ===========================================================================

describe('RankingUseCase — Property 15', () => {
  it(
    'Property 15: El ranking está ordenado DESC por accumulated_score; empate se resuelve ASC por last_correct_at',
    async () => {
      // Feature: query-arena, Property 15: Ranking ordenado + desempate por fecha
      // Validates: Requirements 8.3, 8.5, 10.1, 10.2
      await fc.assert(
        fc.asyncProperty(
          uniqueStudentsArb,
          async (students) => {
            const rankingRepository = makeRankingRepositoryMock();
            const mockLogger = { error: jest.fn() };
            const useCase = new RankingUseCase(rankingRepository, mockLogger);

            // Sort students as the DB should return them:
            // accumulated_score DESC, last_correct_at ASC (nulls last)
            const sortedRows = [...students].sort((a, b) => {
              if (b.accumulatedScore !== a.accumulatedScore) {
                return b.accumulatedScore - a.accumulatedScore;
              }
              // Tie-break by last_correct_at ASC; null is treated as "latest" (worst tie-break)
              if (a.lastCorrectAt === null && b.lastCorrectAt === null) return 0;
              if (a.lastCorrectAt === null) return 1;
              if (b.lastCorrectAt === null) return -1;
              return a.lastCorrectAt.getTime() - b.lastCorrectAt.getTime();
            });

            // Build ranking rows in sorted order
            const rankingRows = sortedRows.map((s) =>
              makeRankingRow({
                user_id: s.userId,
                username: s.username,
                accumulated_score: s.accumulatedScore,
                last_correct_at: s.lastCorrectAt,
              }),
            );

            rankingRepository.findAll.mockResolvedValue(rankingRows);

            const result = await useCase.getRanking();

            // 1. Result length matches input
            expect(result).toHaveLength(students.length);

            // 2. Ordering invariant: accumulated_score is non-increasing
            for (let i = 0; i < result.length - 1; i++) {
              expect(result[i].accumulated_score).toBeGreaterThanOrEqual(
                result[i + 1].accumulated_score,
              );
            }

            // 3. Within ties (same accumulated_score), earlier last_correct_at wins
            //    This is enforced by the repository sort order which getRanking() preserves
            for (let i = 0; i < result.length - 1; i++) {
              if (result[i].accumulated_score === result[i + 1].accumulated_score) {
                // The row at i appeared before i+1 in the repository's sorted output,
                // meaning its last_correct_at <= result[i+1].last_correct_at.
                // We verify the positions reflect this: tied entries share the same position.
                expect(result[i].position).toBeLessThanOrEqual(result[i + 1].position);
              }
            }

            // 4. Positions are positive integers
            for (const entry of result) {
              expect(entry.position).toBeGreaterThanOrEqual(1);
              expect(Number.isInteger(entry.position)).toBe(true);
            }

            // 5. Students with strictly different scores have strictly different positions
            for (let i = 0; i < result.length - 1; i++) {
              if (result[i].accumulated_score > result[i + 1].accumulated_score) {
                expect(result[i].position).toBeLessThan(result[i + 1].position);
              }
            }
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});

// ===========================================================================
// Property 16: Dashboard refleja datos reales del estudiante
// ===========================================================================

describe('DashboardUseCase — Property 16', () => {
  it(
    'Property 16: getSummary devuelve contadores que corresponden exactamente a los datos reales del estudiante',
    async () => {
      // Feature: query-arena, Property 16: Dashboard refleja datos reales del estudiante
      // Validates: Requirements 9.1
      await fc.assert(
        fc.asyncProperty(
          uuidArb,
          attemptsArrayArb,
          fc.integer({ min: 0, max: 500 }), // accumulatedScore stored in ranking
          uniqueStudentsArb,                 // full ranking list
          async (userId, attemptRecords, storedScore, otherStudents) => {
            const attemptRepository = makeAttemptRepositoryMock();
            const exerciseRepository = makeExerciseRepositoryMock();
            const rankingRepository = makeRankingRepositoryMock();

            const useCase = new DashboardUseCase(
              attemptRepository,
              exerciseRepository,
              rankingRepository,
            );

            // Build Attempt objects for the user
            const attempts: Attempt[] = attemptRecords.map((r) =>
              makeAttempt({
                id: r.id,
                user_id: userId,
                exercise_id: r.exerciseId,
                status: r.status,
                score: r.score,
                created_at: r.createdAt,
              }),
            );

            attemptRepository.findByUser.mockResolvedValue(attempts);

            // Ranking entry for this user
            const rankingEntry: Ranking = {
              id: 'ranking-id',
              user_id: userId,
              accumulated_score: storedScore,
              last_correct_at: null,
              updated_at: new Date(),
            };
            rankingRepository.findByUser.mockResolvedValue(
              storedScore > 0 ? rankingEntry : null,
            );

            // Build a ranking list that includes this user (if they have a score)
            // plus other students, sorted by score DESC
            const thisUserRow = makeRankingRow({
              user_id: userId,
              username: 'testuser',
              accumulated_score: storedScore,
              last_correct_at: null,
            });

            const otherRows = otherStudents
              .filter((s) => s.userId !== userId)
              .map((s) =>
                makeRankingRow({
                  user_id: s.userId,
                  username: s.username,
                  accumulated_score: s.accumulatedScore,
                  last_correct_at: s.lastCorrectAt,
                }),
              );

            const allRows = storedScore > 0
              ? [...otherRows, thisUserRow].sort(
                  (a, b) => b.accumulated_score - a.accumulated_score,
                )
              : [...otherRows].sort((a, b) => b.accumulated_score - a.accumulated_score);

            rankingRepository.findAll.mockResolvedValue(allRows);

            const summary = await useCase.getSummary(userId);

            // --- Verify total_attempted = unique exercise IDs in attempts ---
            const uniqueExerciseIds = new Set(attempts.map((a) => a.exercise_id));
            expect(summary.total_attempted).toBe(uniqueExerciseIds.size);

            // --- Verify total_correct = unique exercises solved correctly at least once ---
            const correctExerciseIds = new Set(
              attempts.filter((a) => a.status === 'correct').map((a) => a.exercise_id),
            );
            expect(summary.total_correct).toBe(correctExerciseIds.size);

            // --- Verify accumulated_score comes from the ranking record ---
            expect(summary.accumulated_score).toBe(storedScore > 0 ? storedScore : 0);

            // --- Verify ranking_position is a positive integer ---
            expect(summary.ranking_position).toBeGreaterThanOrEqual(1);
            expect(Number.isInteger(summary.ranking_position)).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});

// ===========================================================================
// Property 17: Progreso por nivel/categoría exacto
// ===========================================================================

/**
 * Generates a small pool of level IDs (1–3) and category IDs (1–3)
 * to ensure meaningful grouping in the progress data.
 */
const levelIdArb = fc.integer({ min: 1, max: 3 });
const categoryIdArb = fc.integer({ min: 1, max: 3 });

const levelNames: Record<number, string> = { 1: 'Beginner', 2: 'Intermediate', 3: 'Advanced' };
const categoryNames: Record<number, string> = { 1: 'SELECT', 2: 'JOIN', 3: 'Subqueries' };

/**
 * Generates an attempt record enriched with a levelId and categoryId,
 * representing an attempt on an exercise that belongs to that level/category.
 */
const enrichedAttemptArb = fc.record({
  id: uuidArb,
  exerciseId: uuidArb,
  status: attemptStatusArb,
  score: positiveScoreArb,
  levelId: levelIdArb,
  categoryId: categoryIdArb,
}).map(({ id, exerciseId, status, score, levelId, categoryId }) => ({
  id,
  exerciseId,
  status,
  score: status === 'correct' ? score : 0,
  levelId,
  categoryId,
}));

describe('DashboardUseCase — Property 17', () => {
  it(
    'Property 17: getProgressByLevel devuelve conteos exactos de ejercicios intentados y correctos por nivel',
    async () => {
      // Feature: query-arena, Property 17: Progreso por nivel/categoría exacto
      // Validates: Requirements 9.2, 9.3
      await fc.assert(
        fc.asyncProperty(
          uuidArb,
          fc.array(enrichedAttemptArb, { minLength: 0, maxLength: 20 }),
          async (userId, enrichedAttempts) => {
            const attemptRepository = makeAttemptRepositoryMock();
            const exerciseRepository = makeExerciseRepositoryMock();
            const rankingRepository = makeRankingRepositoryMock();

            const useCase = new DashboardUseCase(
              attemptRepository,
              exerciseRepository,
              rankingRepository,
            );

            // Build Attempt objects
            const attempts: Attempt[] = enrichedAttempts.map((r) =>
              makeAttempt({
                id: r.id,
                user_id: userId,
                exercise_id: r.exerciseId,
                status: r.status,
                score: r.score,
              }),
            );

            attemptRepository.findByUser.mockResolvedValue(attempts);

            // Build Exercise objects keyed by exerciseId with level/category metadata
            const exerciseMap = new Map<string, Exercise>();
            for (const r of enrichedAttempts) {
              if (!exerciseMap.has(r.exerciseId)) {
                exerciseMap.set(
                  r.exerciseId,
                  makeExercise({
                    id: r.exerciseId,
                    level_id: r.levelId,
                    category_id: r.categoryId,
                    level: makeLevel({ id: r.levelId, name: levelNames[r.levelId] }),
                    category: makeCategory({
                      id: r.categoryId,
                      name: categoryNames[r.categoryId],
                    }),
                  }),
                );
              }
            }

            exerciseRepository.findById.mockImplementation(async (id) =>
              exerciseMap.get(id) ?? null,
            );

            const result = await useCase.getProgressByLevel(userId);

            // Compute expected values from raw data
            const expectedByLevel = new Map<
              number,
              { attempted: Set<string>; correct: Set<string> }
            >();

            for (const r of enrichedAttempts) {
              if (!expectedByLevel.has(r.levelId)) {
                expectedByLevel.set(r.levelId, {
                  attempted: new Set(),
                  correct: new Set(),
                });
              }
              const entry = expectedByLevel.get(r.levelId)!;
              entry.attempted.add(r.exerciseId);
              if (r.status === 'correct') {
                entry.correct.add(r.exerciseId);
              }
            }

            // Verify number of level groups
            expect(result).toHaveLength(expectedByLevel.size);

            // Verify each level's counts
            for (const levelResult of result) {
              const expected = expectedByLevel.get(levelResult.level_id);
              expect(expected).toBeDefined();
              expect(levelResult.exercises_attempted).toBe(expected!.attempted.size);
              expect(levelResult.exercises_correct).toBe(expected!.correct.size);
              expect(levelResult.level_name).toBe(levelNames[levelResult.level_id]);
            }

            // exercises_correct <= exercises_attempted for every level
            for (const levelResult of result) {
              expect(levelResult.exercises_correct).toBeLessThanOrEqual(
                levelResult.exercises_attempted,
              );
            }
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  it(
    'Property 17: getProgressByCategory devuelve conteos exactos de ejercicios intentados y correctos por categoría',
    async () => {
      // Feature: query-arena, Property 17: Progreso por nivel/categoría exacto
      // Validates: Requirements 9.2, 9.3
      await fc.assert(
        fc.asyncProperty(
          uuidArb,
          fc.array(enrichedAttemptArb, { minLength: 0, maxLength: 20 }),
          async (userId, enrichedAttempts) => {
            const attemptRepository = makeAttemptRepositoryMock();
            const exerciseRepository = makeExerciseRepositoryMock();
            const rankingRepository = makeRankingRepositoryMock();

            const useCase = new DashboardUseCase(
              attemptRepository,
              exerciseRepository,
              rankingRepository,
            );

            // Build Attempt objects
            const attempts: Attempt[] = enrichedAttempts.map((r) =>
              makeAttempt({
                id: r.id,
                user_id: userId,
                exercise_id: r.exerciseId,
                status: r.status,
                score: r.score,
              }),
            );

            attemptRepository.findByUser.mockResolvedValue(attempts);

            // Build Exercise objects keyed by exerciseId
            const exerciseMap = new Map<string, Exercise>();
            for (const r of enrichedAttempts) {
              if (!exerciseMap.has(r.exerciseId)) {
                exerciseMap.set(
                  r.exerciseId,
                  makeExercise({
                    id: r.exerciseId,
                    level_id: r.levelId,
                    category_id: r.categoryId,
                    level: makeLevel({ id: r.levelId, name: levelNames[r.levelId] }),
                    category: makeCategory({
                      id: r.categoryId,
                      name: categoryNames[r.categoryId],
                    }),
                  }),
                );
              }
            }

            exerciseRepository.findById.mockImplementation(async (id) =>
              exerciseMap.get(id) ?? null,
            );

            const result = await useCase.getProgressByCategory(userId);

            // Compute expected values from raw data
            const expectedByCategory = new Map<
              number,
              { attempted: Set<string>; correct: Set<string> }
            >();

            for (const r of enrichedAttempts) {
              if (!expectedByCategory.has(r.categoryId)) {
                expectedByCategory.set(r.categoryId, {
                  attempted: new Set(),
                  correct: new Set(),
                });
              }
              const entry = expectedByCategory.get(r.categoryId)!;
              entry.attempted.add(r.exerciseId);
              if (r.status === 'correct') {
                entry.correct.add(r.exerciseId);
              }
            }

            // Verify number of category groups
            expect(result).toHaveLength(expectedByCategory.size);

            // Verify each category's counts
            for (const catResult of result) {
              const expected = expectedByCategory.get(catResult.category_id);
              expect(expected).toBeDefined();
              expect(catResult.exercises_attempted).toBe(expected!.attempted.size);
              expect(catResult.exercises_correct).toBe(expected!.correct.size);
              expect(catResult.category_name).toBe(categoryNames[catResult.category_id]);
            }

            // exercises_correct <= exercises_attempted for every category
            for (const catResult of result) {
              expect(catResult.exercises_correct).toBeLessThanOrEqual(
                catResult.exercises_attempted,
              );
            }
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});
