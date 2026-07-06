/**
 * Unit tests for DashboardUseCase
 * All ports are mocked with jest.fn() — no real database.
 *
 * Requirements covered: 9.1, 9.4, 9.5
 */

import { DashboardUseCase } from '../../src/domain/use-cases/DashboardUseCase';
import type { IAttemptRepository } from '../../src/domain/ports/out/IAttemptRepository';
import type { IExerciseRepository } from '../../src/domain/ports/out/IExerciseRepository';
import type { IRankingRepository } from '../../src/domain/ports/out/IRankingRepository';
import type { Attempt } from '../../src/domain/entities/Attempt';
import type { Exercise } from '../../src/domain/entities/Exercise';
import type { Ranking } from '../../src/domain/entities/Ranking';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAttempt(overrides: Partial<Attempt> = {}): Attempt {
  return {
    id: 'attempt-id-1',
    user_id: 'user-id-1',
    exercise_id: 'exercise-id-1',
    query_sent: 'SELECT * FROM users',
    status: 'correct',
    score: 10,
    resolution_time_ms: 1200,
    created_at: new Date('2024-01-01T10:00:00.000Z'),
    ...overrides,
  };
}

function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'exercise-id-1',
    title: 'Select all users',
    description: 'Write a query to select all users.',
    expected_solution: 'SELECT * FROM users',
    score: 10,
    is_active: true,
    level_id: 1,
    category_id: 1,
    created_at: new Date('2024-01-01T00:00:00.000Z'),
    updated_at: new Date('2024-01-01T00:00:00.000Z'),
    level: { id: 1, name: 'Beginner', created_at: new Date('2024-01-01T00:00:00.000Z') },
    category: { id: 1, name: 'SELECT', created_at: new Date('2024-01-01T00:00:00.000Z') },
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

function makeMocks() {
  const attemptRepository: jest.Mocked<IAttemptRepository> = {
    create: jest.fn(),
    findByUser: jest.fn(),
    update: jest.fn(),
    countByExercise: jest.fn(),
  };

  const exerciseRepository: jest.Mocked<IExerciseRepository> = {
    findAll: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    countByLevel: jest.fn(),
    countByCategory: jest.fn(),
  };

  const rankingRepository: jest.Mocked<IRankingRepository> = {
    upsert: jest.fn(),
    findAll: jest.fn(),
    findByUser: jest.fn(),
  };

  const useCase = new DashboardUseCase(attemptRepository, exerciseRepository, rankingRepository);

  return { useCase, attemptRepository, exerciseRepository, rankingRepository };
}

// ---------------------------------------------------------------------------
// getSummary()
// ---------------------------------------------------------------------------

describe('DashboardUseCase.getSummary()', () => {
  it('1. student with no attempts → returns { total_attempted: 0, total_correct: 0, accumulated_score: 0, ranking_position: 1 } (Req 9.1, 9.5)', async () => {
    const { useCase, attemptRepository, rankingRepository } = makeMocks();

    attemptRepository.findByUser.mockResolvedValue([]);
    rankingRepository.findByUser.mockResolvedValue(null);
    rankingRepository.findAll.mockResolvedValue([]);

    const result = await useCase.getSummary('user-id-1');

    expect(result).toEqual({
      total_attempted: 0,
      total_correct: 0,
      accumulated_score: 0,
      ranking_position: 1,
    });
  });

  it('2. student with only incorrect attempts → total_correct = 0, accumulated_score = 0', async () => {
    const { useCase, attemptRepository, rankingRepository } = makeMocks();

    attemptRepository.findByUser.mockResolvedValue([
      makeAttempt({ id: 'a-1', exercise_id: 'ex-1', status: 'incorrect', score: 0 }),
      makeAttempt({ id: 'a-2', exercise_id: 'ex-2', status: 'incorrect', score: 0 }),
    ]);
    rankingRepository.findByUser.mockResolvedValue(null);
    rankingRepository.findAll.mockResolvedValue([]);

    const result = await useCase.getSummary('user-id-1');

    expect(result.total_attempted).toBe(2);
    expect(result.total_correct).toBe(0);
    expect(result.accumulated_score).toBe(0);
  });

  it('3. student with mix of correct and incorrect attempts → correct counts only unique exercises', async () => {
    const { useCase, attemptRepository, rankingRepository } = makeMocks();

    // ex-1 attempted twice (once correct, once incorrect) → counts as 1 correct unique
    // ex-2 only incorrect
    // ex-3 only correct
    attemptRepository.findByUser.mockResolvedValue([
      makeAttempt({ id: 'a-1', exercise_id: 'ex-1', status: 'correct', score: 10 }),
      makeAttempt({ id: 'a-2', exercise_id: 'ex-1', status: 'incorrect', score: 0 }),
      makeAttempt({ id: 'a-3', exercise_id: 'ex-2', status: 'incorrect', score: 0 }),
      makeAttempt({ id: 'a-4', exercise_id: 'ex-3', status: 'correct', score: 15 }),
    ]);
    rankingRepository.findByUser.mockResolvedValue(
      makeRankingRow({ user_id: 'user-id-1', accumulated_score: 25 }),
    );
    rankingRepository.findAll.mockResolvedValue([
      makeRankingRow({ user_id: 'user-id-1', accumulated_score: 25 }),
    ]);

    const result = await useCase.getSummary('user-id-1');

    expect(result.total_attempted).toBe(3); // ex-1, ex-2, ex-3
    expect(result.total_correct).toBe(2);   // ex-1, ex-3
  });

  it('4. accumulated_score comes from rankingRepository.findByUser, not from attempt sum', async () => {
    const { useCase, attemptRepository, rankingRepository } = makeMocks();

    attemptRepository.findByUser.mockResolvedValue([
      makeAttempt({ id: 'a-1', exercise_id: 'ex-1', status: 'correct', score: 999 }),
    ]);
    // Ranking stores 42 regardless of the attempt score
    rankingRepository.findByUser.mockResolvedValue(
      makeRankingRow({ user_id: 'user-id-1', accumulated_score: 42 }),
    );
    rankingRepository.findAll.mockResolvedValue([
      makeRankingRow({ user_id: 'user-id-1', accumulated_score: 42 }),
    ]);

    const result = await useCase.getSummary('user-id-1');

    expect(result.accumulated_score).toBe(42);
  });

  it('5. ranking_position computed correctly (first index with same score + 1, 1-based)', async () => {
    const { useCase, attemptRepository, rankingRepository } = makeMocks();

    attemptRepository.findByUser.mockResolvedValue([
      makeAttempt({ id: 'a-1', exercise_id: 'ex-1', status: 'correct', score: 50 }),
    ]);
    rankingRepository.findByUser.mockResolvedValue(
      makeRankingRow({ user_id: 'user-id-1', accumulated_score: 50 }),
    );
    // user-id-1 is at index 1 (second) in the sorted list → position 2
    rankingRepository.findAll.mockResolvedValue([
      makeRankingRow({ user_id: 'user-id-2', username: 'top', accumulated_score: 100 }),
      makeRankingRow({ user_id: 'user-id-1', username: 'student1', accumulated_score: 50 }),
    ]);

    const result = await useCase.getSummary('user-id-1');

    expect(result.ranking_position).toBe(2);
  });

  it('6. student not in ranking list → ranking_position computed from ahead count + 1', async () => {
    const { useCase, attemptRepository, rankingRepository } = makeMocks();

    attemptRepository.findByUser.mockResolvedValue([]);
    rankingRepository.findByUser.mockResolvedValue(null);
    // Two students with score > 0 are ahead
    rankingRepository.findAll.mockResolvedValue([
      makeRankingRow({ user_id: 'user-id-2', username: 'top', accumulated_score: 200 }),
      makeRankingRow({ user_id: 'user-id-3', username: 'second', accumulated_score: 100 }),
    ]);

    const result = await useCase.getSummary('user-id-1');

    // 2 students with score > 0 ahead → position 3
    expect(result.ranking_position).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// getRecentHistory()
// ---------------------------------------------------------------------------

describe('DashboardUseCase.getRecentHistory()', () => {
  it('1. student with no attempts → returns empty array (no error) (Req 9.5)', async () => {
    const { useCase, attemptRepository } = makeMocks();

    attemptRepository.findByUser.mockResolvedValue([]);

    const result = await useCase.getRecentHistory('user-id-1');

    expect(result).toEqual([]);
  });

  it('2. student with exactly 10 attempts → returns all 10 (Req 9.4)', async () => {
    const { useCase, attemptRepository, exerciseRepository } = makeMocks();

    const attempts = Array.from({ length: 10 }, (_, i) =>
      makeAttempt({
        id: `attempt-${i}`,
        exercise_id: `exercise-${i}`,
        created_at: new Date(2024, 0, 10 - i),
      }),
    );

    attemptRepository.findByUser.mockResolvedValue(attempts);
    exerciseRepository.findById.mockImplementation((id) =>
      Promise.resolve(makeExercise({ id, title: `Exercise ${id}` })),
    );

    const result = await useCase.getRecentHistory('user-id-1');

    expect(result).toHaveLength(10);
  });

  it('3. student with 15 attempts → returns only 10 most recent (Req 9.4)', async () => {
    const { useCase, attemptRepository, exerciseRepository } = makeMocks();

    // Repository already returns DESC order; 15 total
    const attempts = Array.from({ length: 15 }, (_, i) =>
      makeAttempt({
        id: `attempt-${i}`,
        exercise_id: `exercise-${i}`,
        created_at: new Date(2024, 0, 15 - i),
      }),
    );

    attemptRepository.findByUser.mockResolvedValue(attempts);
    exerciseRepository.findById.mockImplementation((id) =>
      Promise.resolve(makeExercise({ id, title: `Exercise ${id}` })),
    );

    const result = await useCase.getRecentHistory('user-id-1');

    expect(result).toHaveLength(10);
  });

  it('4. each entry contains attempt_id, exercise_title, status, score, created_at', async () => {
    const { useCase, attemptRepository, exerciseRepository } = makeMocks();

    const attempt = makeAttempt({
      id: 'attempt-1',
      exercise_id: 'exercise-1',
      status: 'correct',
      score: 20,
      created_at: new Date('2024-06-01T12:00:00.000Z'),
    });

    attemptRepository.findByUser.mockResolvedValue([attempt]);
    exerciseRepository.findById.mockResolvedValue(
      makeExercise({ id: 'exercise-1', title: 'My Exercise' }),
    );

    const result = await useCase.getRecentHistory('user-id-1');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      attempt_id: 'attempt-1',
      exercise_title: 'My Exercise',
      status: 'correct',
      score: 20,
      created_at: new Date('2024-06-01T12:00:00.000Z'),
    });
  });

  it('5. exercise title comes from exerciseRepository.findById', async () => {
    const { useCase, attemptRepository, exerciseRepository } = makeMocks();

    attemptRepository.findByUser.mockResolvedValue([
      makeAttempt({ id: 'a-1', exercise_id: 'ex-42' }),
    ]);
    exerciseRepository.findById.mockResolvedValue(
      makeExercise({ id: 'ex-42', title: 'Complex JOIN query' }),
    );

    const result = await useCase.getRecentHistory('user-id-1');

    expect(exerciseRepository.findById).toHaveBeenCalledWith('ex-42');
    expect(result[0].exercise_title).toBe('Complex JOIN query');
  });

  it('6. unknown exercise (findById returns null) → title is "Unknown exercise"', async () => {
    const { useCase, attemptRepository, exerciseRepository } = makeMocks();

    attemptRepository.findByUser.mockResolvedValue([
      makeAttempt({ id: 'a-1', exercise_id: 'ex-missing' }),
    ]);
    exerciseRepository.findById.mockResolvedValue(null);

    const result = await useCase.getRecentHistory('user-id-1');

    expect(result[0].exercise_title).toBe('Unknown exercise');
  });
});

// ---------------------------------------------------------------------------
// getProgressByLevel()
// ---------------------------------------------------------------------------

describe('DashboardUseCase.getProgressByLevel()', () => {
  it('7. student with no attempts → returns empty array', async () => {
    const { useCase, attemptRepository } = makeMocks();

    attemptRepository.findByUser.mockResolvedValue([]);

    const result = await useCase.getProgressByLevel('user-id-1');

    expect(result).toEqual([]);
  });

  it('8. attempts across two levels → correct per-level counts returned', async () => {
    const { useCase, attemptRepository, exerciseRepository } = makeMocks();

    attemptRepository.findByUser.mockResolvedValue([
      makeAttempt({ id: 'a-1', exercise_id: 'ex-1', status: 'correct' }),
      makeAttempt({ id: 'a-2', exercise_id: 'ex-2', status: 'incorrect' }),
      makeAttempt({ id: 'a-3', exercise_id: 'ex-3', status: 'correct' }),
    ]);

    exerciseRepository.findById.mockImplementation((id) => {
      const levelMap: Record<string, number> = { 'ex-1': 1, 'ex-2': 1, 'ex-3': 2 };
      const levelNameMap: Record<number, string> = { 1: 'Beginner', 2: 'Intermediate' };
      const levelId = levelMap[id] ?? 1;
      return Promise.resolve(
        makeExercise({
          id,
          level_id: levelId,
          level: { id: levelId, name: levelNameMap[levelId], created_at: new Date() },
        }),
      );
    });

    const result = await useCase.getProgressByLevel('user-id-1');

    expect(result).toHaveLength(2);

    const beginner = result.find((r) => r.level_id === 1);
    expect(beginner).toMatchObject({
      level_id: 1,
      level_name: 'Beginner',
      exercises_attempted: 2,
      exercises_correct: 1,
    });

    const intermediate = result.find((r) => r.level_id === 2);
    expect(intermediate).toMatchObject({
      level_id: 2,
      level_name: 'Intermediate',
      exercises_attempted: 1,
      exercises_correct: 1,
    });
  });

  it('9. same exercise attempted multiple times → counts as 1 unique in both attempted and correct', async () => {
    const { useCase, attemptRepository, exerciseRepository } = makeMocks();

    // ex-1 attempted 3 times: 2 incorrect, 1 correct
    attemptRepository.findByUser.mockResolvedValue([
      makeAttempt({ id: 'a-1', exercise_id: 'ex-1', status: 'incorrect' }),
      makeAttempt({ id: 'a-2', exercise_id: 'ex-1', status: 'incorrect' }),
      makeAttempt({ id: 'a-3', exercise_id: 'ex-1', status: 'correct' }),
    ]);

    exerciseRepository.findById.mockResolvedValue(
      makeExercise({
        id: 'ex-1',
        level_id: 1,
        level: { id: 1, name: 'Beginner', created_at: new Date() },
      }),
    );

    const result = await useCase.getProgressByLevel('user-id-1');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      level_id: 1,
      exercises_attempted: 1, // unique exercises
      exercises_correct: 1,
    });
  });
});

// ---------------------------------------------------------------------------
// getProgressByCategory()
// ---------------------------------------------------------------------------

describe('DashboardUseCase.getProgressByCategory()', () => {
  it('10. student with no attempts → returns empty array', async () => {
    const { useCase, attemptRepository } = makeMocks();

    attemptRepository.findByUser.mockResolvedValue([]);

    const result = await useCase.getProgressByCategory('user-id-1');

    expect(result).toEqual([]);
  });

  it('11. attempts across two categories → correct per-category counts returned', async () => {
    const { useCase, attemptRepository, exerciseRepository } = makeMocks();

    attemptRepository.findByUser.mockResolvedValue([
      makeAttempt({ id: 'a-1', exercise_id: 'ex-1', status: 'correct' }),
      makeAttempt({ id: 'a-2', exercise_id: 'ex-2', status: 'incorrect' }),
      makeAttempt({ id: 'a-3', exercise_id: 'ex-3', status: 'correct' }),
    ]);

    exerciseRepository.findById.mockImplementation((id) => {
      const categoryMap: Record<string, number> = { 'ex-1': 1, 'ex-2': 1, 'ex-3': 2 };
      const categoryNameMap: Record<number, string> = { 1: 'SELECT', 2: 'JOIN' };
      const categoryId = categoryMap[id] ?? 1;
      return Promise.resolve(
        makeExercise({
          id,
          category_id: categoryId,
          category: { id: categoryId, name: categoryNameMap[categoryId], created_at: new Date() },
        }),
      );
    });

    const result = await useCase.getProgressByCategory('user-id-1');

    expect(result).toHaveLength(2);

    const selectCategory = result.find((r) => r.category_id === 1);
    expect(selectCategory).toMatchObject({
      category_id: 1,
      category_name: 'SELECT',
      exercises_attempted: 2,
      exercises_correct: 1,
    });

    const joinCategory = result.find((r) => r.category_id === 2);
    expect(joinCategory).toMatchObject({
      category_id: 2,
      category_name: 'JOIN',
      exercises_attempted: 1,
      exercises_correct: 1,
    });
  });
});
