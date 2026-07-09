/**
 * Additional unit tests for AttemptUseCase — covering lines not reached by the
 * existing PBT spec:
 *   - Line 32: EMPTY_QUERY thrown when querySent is blank
 *   - Line 59: EXERCISE_NOT_FOUND thrown when exercise does not exist
 *   - Line 69: ranking upsert failure is caught and silenced (fire-and-forget)
 *   - Line 106: exercise_title mapped as null when not present on attempt row
 */

import { AttemptUseCase } from '../../src/domain/use-cases/AttemptUseCase';
import type { IAttemptRepository }  from '../../src/domain/ports/out/IAttemptRepository';
import type { IExerciseRepository } from '../../src/domain/ports/out/IExerciseRepository';
import type { IRankingRepository }  from '../../src/domain/ports/out/IRankingRepository';
import type { IResultUseCase }      from '../../src/domain/ports/in/IResultUseCase';
import type { Attempt }             from '../../src/domain/entities/Attempt';
import type { Exercise, Level, Category } from '../../src/domain/entities/Exercise';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const now = new Date('2024-01-15T10:00:00Z');

function makeLevel(o: Partial<Level> = {}): Level {
  return { id: 1, name: 'Básico', created_at: now, ...o };
}
function makeCategory(o: Partial<Category> = {}): Category {
  return { id: 1, name: 'SELECT', created_at: now, ...o };
}
function makeExercise(o: Partial<Exercise> = {}): Exercise {
  return {
    id: 'ex-1', title: 'Select users', description: 'Write SELECT *',
    expected_solution: 'SELECT * FROM users', score: 10,
    is_active: true, level_id: 1, category_id: 1,
    created_at: now, updated_at: now,
    level: makeLevel(), category: makeCategory(),
    ...o,
  };
}
function makeAttempt(o: Partial<Attempt & { exercise_title?: string | null }> = {}): Attempt {
  return {
    id: 'att-1', user_id: 'u-1', exercise_id: 'ex-1',
    query_sent: 'SELECT * FROM users', status: 'incorrect',
    score: 0, resolution_time_ms: 1000, created_at: now, ...o,
  };
}

// ── Mock factory ──────────────────────────────────────────────────────────────

function makeMocks() {
  const attemptRepository: jest.Mocked<IAttemptRepository> = {
    create: jest.fn(), findByUser: jest.fn(),
    update: jest.fn(), countByExercise: jest.fn(),
  };
  const exerciseRepository: jest.Mocked<IExerciseRepository> = {
    findAll: jest.fn(), findById: jest.fn(), create: jest.fn(),
    update: jest.fn(), delete: jest.fn(),
    countByLevel: jest.fn(), countByCategory: jest.fn(),
  };
  const rankingRepository: jest.Mocked<IRankingRepository> = {
    upsert: jest.fn(), findAll: jest.fn(), findByUser: jest.fn(),
  };
  const resultUseCase: jest.Mocked<IResultUseCase> = {
    evaluateAttempt: jest.fn(),
  };
  const useCase = new AttemptUseCase(
    attemptRepository, exerciseRepository, rankingRepository, resultUseCase,
  );
  return { useCase, attemptRepository, exerciseRepository, rankingRepository, resultUseCase };
}

// =============================================================================
// submitAttempt() — EMPTY_QUERY (line 32)
// =============================================================================

describe('AttemptUseCase.submitAttempt() — EMPTY_QUERY', () => {
  it('empty string → throws EMPTY_QUERY', async () => {
    const { useCase } = makeMocks();
    await expect(useCase.submitAttempt('u-1', 'ex-1', '', 500)).rejects.toMatchObject({
      code: 'EMPTY_QUERY', field: 'query',
    });
  });

  it('whitespace-only string → throws EMPTY_QUERY', async () => {
    const { useCase } = makeMocks();
    await expect(useCase.submitAttempt('u-1', 'ex-1', '   ', 500)).rejects.toMatchObject({
      code: 'EMPTY_QUERY', field: 'query',
    });
  });

  it('blank query — attemptRepository.create is never called', async () => {
    const { useCase, attemptRepository } = makeMocks();
    await expect(useCase.submitAttempt('u-1', 'ex-1', '\t\n', 500)).rejects.toMatchObject({
      code: 'EMPTY_QUERY',
    });
    expect(attemptRepository.create).not.toHaveBeenCalled();
  });
});

// =============================================================================
// submitAttempt() — EXERCISE_NOT_FOUND (line 59)
// =============================================================================

describe('AttemptUseCase.submitAttempt() — EXERCISE_NOT_FOUND', () => {
  it('exercise not found → throws EXERCISE_NOT_FOUND', async () => {
    const { useCase, exerciseRepository } = makeMocks();
    exerciseRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.submitAttempt('u-1', 'nonexistent', 'SELECT 1', 500),
    ).rejects.toMatchObject({ code: 'EXERCISE_NOT_FOUND' });
  });

  it('exercise not found — attemptRepository.create is never called', async () => {
    const { useCase, exerciseRepository, attemptRepository } = makeMocks();
    exerciseRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.submitAttempt('u-1', 'nonexistent', 'SELECT 1', 500),
    ).rejects.toMatchObject({ code: 'EXERCISE_NOT_FOUND' });

    expect(attemptRepository.create).not.toHaveBeenCalled();
  });
});

// =============================================================================
// submitAttempt() — ranking upsert error is silenced (line 69, fire-and-forget)
// =============================================================================

describe('AttemptUseCase.submitAttempt() — ranking error silenced', () => {
  it('ranking upsert failure does not propagate to caller', async () => {
    const { useCase, exerciseRepository, attemptRepository, rankingRepository, resultUseCase } =
      makeMocks();

    exerciseRepository.findById.mockResolvedValue(makeExercise());
    attemptRepository.create.mockResolvedValue(makeAttempt());
    resultUseCase.evaluateAttempt.mockResolvedValue({
      status: 'correct',
      score: 10,
      hint: null,
    });
    // Simulate ranking DB failure
    rankingRepository.upsert.mockRejectedValue(new Error('DB timeout'));

    // Must NOT throw — error is swallowed by the fire-and-forget catch
    const result = await useCase.submitAttempt('u-1', 'ex-1', 'SELECT * FROM users', 1000);

    expect(result.status).toBe('correct');
    expect(result.score).toBe(10);
    // Give the microtask queue a tick so the .catch() fires
    await Promise.resolve();
    expect(rankingRepository.upsert).toHaveBeenCalledWith('u-1', 10);
  });

  it('incorrect attempt → ranking upsert is NOT called', async () => {
    const { useCase, exerciseRepository, attemptRepository, rankingRepository, resultUseCase } =
      makeMocks();

    exerciseRepository.findById.mockResolvedValue(makeExercise());
    attemptRepository.create.mockResolvedValue(makeAttempt());
    resultUseCase.evaluateAttempt.mockResolvedValue({
      status: 'incorrect',
      score: 0,
      hint: 'Review your query.',
    });

    await useCase.submitAttempt('u-1', 'ex-1', 'SELECT 1', 1000);

    expect(rankingRepository.upsert).not.toHaveBeenCalled();
  });

  it('error status → ranking upsert is NOT called', async () => {
    const { useCase, exerciseRepository, attemptRepository, rankingRepository, resultUseCase } =
      makeMocks();

    exerciseRepository.findById.mockResolvedValue(makeExercise());
    attemptRepository.create.mockResolvedValue(makeAttempt());
    resultUseCase.evaluateAttempt.mockResolvedValue({
      status: 'error',
      score: 0,
      hint: 'Syntax error.',
    });

    await useCase.submitAttempt('u-1', 'ex-1', 'NOT SQL', 1000);

    expect(rankingRepository.upsert).not.toHaveBeenCalled();
  });
});

// =============================================================================
// getAttemptHistory() — exercise_title mapping (line 106)
// =============================================================================

describe('AttemptUseCase.getAttemptHistory() — exercise_title mapping', () => {
  it('maps exercise_title when present on the row', async () => {
    const { useCase, attemptRepository } = makeMocks();

    const row = Object.assign(makeAttempt(), { exercise_title: 'Select all users' });
    attemptRepository.findByUser.mockResolvedValue([row]);

    const history = await useCase.getAttemptHistory('u-1');

    expect(history[0]!.exercise_title).toBe('Select all users');
  });

  it('maps exercise_title as null when not present on the row', async () => {
    const { useCase, attemptRepository } = makeMocks();

    // Plain Attempt without exercise_title property
    attemptRepository.findByUser.mockResolvedValue([makeAttempt()]);

    const history = await useCase.getAttemptHistory('u-1');

    expect(history[0]!.exercise_title).toBeNull();
  });

  it('maps exercise_title as null when explicitly null on the row', async () => {
    const { useCase, attemptRepository } = makeMocks();

    const row = Object.assign(makeAttempt(), { exercise_title: null });
    attemptRepository.findByUser.mockResolvedValue([row]);

    const history = await useCase.getAttemptHistory('u-1');

    expect(history[0]!.exercise_title).toBeNull();
  });

  it('passes exerciseId filter to repository', async () => {
    const { useCase, attemptRepository } = makeMocks();
    attemptRepository.findByUser.mockResolvedValue([]);

    await useCase.getAttemptHistory('u-1', 'ex-filter');

    expect(attemptRepository.findByUser).toHaveBeenCalledWith('u-1', 'ex-filter');
  });

  it('returns all required fields in each history item', async () => {
    const { useCase, attemptRepository } = makeMocks();
    const row = Object.assign(makeAttempt({
      id: 'att-1', exercise_id: 'ex-1', query_sent: 'SELECT 1',
      status: 'correct', score: 10, resolution_time_ms: 800, created_at: now,
    }), { exercise_title: 'Test Exercise' });
    attemptRepository.findByUser.mockResolvedValue([row]);

    const history = await useCase.getAttemptHistory('u-1');
    const item = history[0]!;

    expect(item.id).toBe('att-1');
    expect(item.exercise_id).toBe('ex-1');
    expect(item.exercise_title).toBe('Test Exercise');
    expect(item.query_sent).toBe('SELECT 1');
    expect(item.status).toBe('correct');
    expect(item.score).toBe(10);
    expect(item.resolution_time_ms).toBe(800);
    expect(item.created_at).toEqual(now);
  });
});
