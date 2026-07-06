/**
 * Unit tests for ResultUseCase
 * All ports are mocked with jest.fn() — no real database or execution engine.
 */

import { ResultUseCase } from '../../src/domain/use-cases/ResultUseCase';
import type { IAttemptRepository } from '../../src/domain/ports/out/IAttemptRepository';
import type { Attempt } from '../../src/domain/entities/Attempt';

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
    resolution_time_ms: 1000,
    created_at: new Date(),
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
  const useCase = new ResultUseCase(attemptRepository);
  return { useCase, attemptRepository };
}

// ---------------------------------------------------------------------------
// ResultUseCase.evaluateAttempt()
// ---------------------------------------------------------------------------

describe('ResultUseCase.evaluateAttempt()', () => {
  it('1. correct query (exact match) → status=correct, score=exerciseScore, hint=null', async () => {
    const { useCase, attemptRepository } = makeMocks();
    attemptRepository.update.mockResolvedValue(makeAttempt({ status: 'correct', score: 10 }));

    const result = await useCase.evaluateAttempt(
      'attempt-1',
      'SELECT * FROM users',
      'SELECT * FROM users',
      10,
    );

    expect(result.status).toBe('correct');
    expect(result.score).toBe(10);
    expect(result.hint).toBeNull();
  });

  it('2. correct query with different casing/whitespace/semicolon → status=correct (normalization works)', async () => {
    const { useCase, attemptRepository } = makeMocks();
    attemptRepository.update.mockResolvedValue(makeAttempt({ status: 'correct', score: 5 }));

    const result = await useCase.evaluateAttempt(
      'attempt-2',
      'select   *   from   users;',
      'SELECT * FROM users',
      5,
    );

    expect(result.status).toBe('correct');
    expect(result.score).toBe(5);
    expect(result.hint).toBeNull();
  });

  it('3. syntactically valid but wrong query → status=incorrect, score=0, hint is non-null string', async () => {
    const { useCase, attemptRepository } = makeMocks();
    attemptRepository.update.mockResolvedValue(makeAttempt({ status: 'incorrect', score: 0 }));

    const result = await useCase.evaluateAttempt(
      'attempt-3',
      'SELECT id FROM users',
      'SELECT * FROM users',
      10,
    );

    expect(result.status).toBe('incorrect');
    expect(result.score).toBe(0);
    expect(result.hint).not.toBeNull();
    expect(typeof result.hint).toBe('string');
    expect((result.hint as string).length).toBeGreaterThan(0);
  });

  it('4. hint for incorrect does not contain the expectedSolution string', async () => {
    const { useCase, attemptRepository } = makeMocks();
    const expectedSolution = 'SELECT id, name FROM orders WHERE status = 1';
    attemptRepository.update.mockResolvedValue(makeAttempt({ status: 'incorrect', score: 0 }));

    const result = await useCase.evaluateAttempt(
      'attempt-4',
      'SELECT id FROM orders',
      expectedSolution,
      10,
    );

    expect(result.status).toBe('incorrect');
    expect(result.hint).not.toBeNull();
    expect(result.hint).not.toContain(expectedSolution);
  });

  it('5. empty querySent → status=error, score=0, hint non-null', async () => {
    const { useCase, attemptRepository } = makeMocks();
    attemptRepository.update.mockResolvedValue(makeAttempt({ status: 'error', score: 0 }));

    const result = await useCase.evaluateAttempt(
      'attempt-5',
      '',
      'SELECT * FROM users',
      10,
    );

    expect(result.status).toBe('error');
    expect(result.score).toBe(0);
    expect(result.hint).not.toBeNull();
    expect(typeof result.hint).toBe('string');
  });

  it('6. query not starting with SQL keyword (e.g., "INVALID QUERY") → status=error, score=0, hint non-null', async () => {
    const { useCase, attemptRepository } = makeMocks();
    attemptRepository.update.mockResolvedValue(makeAttempt({ status: 'error', score: 0 }));

    const result = await useCase.evaluateAttempt(
      'attempt-6',
      'INVALID QUERY something here',
      'SELECT * FROM users',
      10,
    );

    expect(result.status).toBe('error');
    expect(result.score).toBe(0);
    expect(result.hint).not.toBeNull();
  });

  it('7. query with SELECT FROM (missing column list) → status=error, score=0, hint non-null', async () => {
    const { useCase, attemptRepository } = makeMocks();
    attemptRepository.update.mockResolvedValue(makeAttempt({ status: 'error', score: 0 }));

    const result = await useCase.evaluateAttempt(
      'attempt-7',
      'SELECT FROM users',
      'SELECT * FROM users',
      10,
    );

    expect(result.status).toBe('error');
    expect(result.score).toBe(0);
    expect(result.hint).not.toBeNull();
  });

  it('8. syntax error hint does not reveal the expectedSolution', async () => {
    const { useCase, attemptRepository } = makeMocks();
    const expectedSolution = 'SELECT name, email FROM customers WHERE active = true';
    attemptRepository.update.mockResolvedValue(makeAttempt({ status: 'error', score: 0 }));

    const result = await useCase.evaluateAttempt(
      'attempt-8',
      'SELECT FROM customers',
      expectedSolution,
      10,
    );

    expect(result.status).toBe('error');
    expect(result.hint).not.toBeNull();
    expect(result.hint).not.toContain(expectedSolution);
    // Also check it doesn't contain key parts of the solution
    expect(result.hint).not.toContain('name, email');
    expect(result.hint).not.toContain('active = true');
  });

  it('9a. attemptRepository.update called with correct status and score on correct evaluation', async () => {
    const { useCase, attemptRepository } = makeMocks();
    attemptRepository.update.mockResolvedValue(makeAttempt({ status: 'correct', score: 10 }));

    await useCase.evaluateAttempt(
      'attempt-9a',
      'SELECT * FROM users',
      'SELECT * FROM users',
      10,
    );

    expect(attemptRepository.update).toHaveBeenCalledTimes(1);
    expect(attemptRepository.update).toHaveBeenCalledWith('attempt-9a', { status: 'correct', score: 10 });
  });

  it('9b. attemptRepository.update called with status=incorrect, score=0 on incorrect evaluation', async () => {
    const { useCase, attemptRepository } = makeMocks();
    attemptRepository.update.mockResolvedValue(makeAttempt({ status: 'incorrect', score: 0 }));

    await useCase.evaluateAttempt(
      'attempt-9b',
      'SELECT id FROM users',
      'SELECT * FROM users',
      10,
    );

    expect(attemptRepository.update).toHaveBeenCalledTimes(1);
    expect(attemptRepository.update).toHaveBeenCalledWith('attempt-9b', { status: 'incorrect', score: 0 });
  });

  it('9c. attemptRepository.update called with status=error, score=0 on syntax error', async () => {
    const { useCase, attemptRepository } = makeMocks();
    attemptRepository.update.mockResolvedValue(makeAttempt({ status: 'error', score: 0 }));

    await useCase.evaluateAttempt(
      'attempt-9c',
      '',
      'SELECT * FROM users',
      10,
    );

    expect(attemptRepository.update).toHaveBeenCalledTimes(1);
    expect(attemptRepository.update).toHaveBeenCalledWith('attempt-9c', { status: 'error', score: 0 });
  });

  it('10. exerciseScore=0 safety guard: correct query with exerciseScore=0 → score becomes 1', async () => {
    const { useCase, attemptRepository } = makeMocks();
    attemptRepository.update.mockResolvedValue(makeAttempt({ status: 'correct', score: 1 }));

    const result = await useCase.evaluateAttempt(
      'attempt-10',
      'SELECT * FROM users',
      'SELECT * FROM users',
      0,
    );

    expect(result.status).toBe('correct');
    expect(result.score).toBe(1);
    expect(result.hint).toBeNull();
    // update should also be called with the guarded score
    expect(attemptRepository.update).toHaveBeenCalledWith('attempt-10', { status: 'correct', score: 1 });
  });

  it('11. SELECT without FROM → status=error, score=0, hint non-null', async () => {
    const { useCase, attemptRepository } = makeMocks();
    attemptRepository.update.mockResolvedValue(makeAttempt({ status: 'error', score: 0 }));

    const result = await useCase.evaluateAttempt(
      'attempt-11',
      'SELECT id, name',
      'SELECT id, name FROM products',
      10,
    );

    expect(result.status).toBe('error');
    expect(result.score).toBe(0);
    expect(result.hint).not.toBeNull();
  });

  it('12. whitespace-only querySent → status=error, score=0', async () => {
    const { useCase, attemptRepository } = makeMocks();
    attemptRepository.update.mockResolvedValue(makeAttempt({ status: 'error', score: 0 }));

    const result = await useCase.evaluateAttempt(
      'attempt-12',
      '   ',
      'SELECT * FROM users',
      10,
    );

    expect(result.status).toBe('error');
    expect(result.score).toBe(0);
  });

  it('13. correct query with mixed keyword casing and trailing semicolon → status=correct', async () => {
    const { useCase, attemptRepository } = makeMocks();
    attemptRepository.update.mockResolvedValue(makeAttempt({ status: 'correct', score: 7 }));

    // Normalization: keyword casing + trailing semicolon + whitespace collapse
    const result = await useCase.evaluateAttempt(
      'attempt-13',
      'Select * From users;',
      'SELECT * FROM users',
      7,
    );

    expect(result.status).toBe('correct');
    expect(result.score).toBe(7);
    expect(result.hint).toBeNull();
  });
});
