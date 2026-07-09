/**
 * Unit tests for PostgresAttemptRepository
 * Mocks the `query` helper from database.ts — no real DB required.
 */

import { PostgresAttemptRepository } from '../../src/adapters/out/persistence/postgres/PostgresAttemptRepository';

jest.mock('../../src/infrastructure/database', () => ({
  query: jest.fn(),
}));

import { query } from '../../src/infrastructure/database';
const mockQuery = query as jest.Mock;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseRow = {
  id: 'attempt-1',
  user_id: 'user-1',
  exercise_id: 'ex-1',
  exercise_title: 'Select all',
  query_sent: 'SELECT * FROM users',
  status: 'correct',
  score: 10,
  resolution_time_ms: 1200,
  created_at: new Date('2024-01-01'),
};

const expectedAttempt = {
  id: 'attempt-1',
  user_id: 'user-1',
  exercise_id: 'ex-1',
  exercise_title: 'Select all',
  query_sent: 'SELECT * FROM users',
  status: 'correct',
  score: 10,
  resolution_time_ms: 1200,
  created_at: new Date('2024-01-01'),
};

beforeEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

describe('PostgresAttemptRepository.create', () => {
  it('inserts and returns the created Attempt', async () => {
    mockQuery.mockResolvedValue({ rows: [baseRow] });
    const repo = new PostgresAttemptRepository();

    const result = await repo.create({
      user_id: 'user-1',
      exercise_id: 'ex-1',
      query_sent: 'SELECT * FROM users',
      status: 'correct',
      score: 10,
      resolution_time_ms: 1200,
    });

    expect(result).toEqual(expectedAttempt);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO attempts'),
      ['user-1', 'ex-1', 'SELECT * FROM users', 'correct', 10, 1200],
    );
  });
});

// ---------------------------------------------------------------------------
// findByUser — without exerciseId filter
// ---------------------------------------------------------------------------

describe('PostgresAttemptRepository.findByUser (no filter)', () => {
  it('returns all attempts for a user ordered by created_at DESC', async () => {
    mockQuery.mockResolvedValue({ rows: [baseRow] });
    const repo = new PostgresAttemptRepository();
    const result = await repo.findByUser('user-1');

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(expectedAttempt);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('WHERE a.user_id = $1'),
      ['user-1'],
    );
  });

  it('returns empty array when user has no attempts', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const repo = new PostgresAttemptRepository();
    expect(await repo.findByUser('user-1')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// findByUser — with exerciseId filter
// ---------------------------------------------------------------------------

describe('PostgresAttemptRepository.findByUser (with exerciseId)', () => {
  it('returns attempts filtered by exercise', async () => {
    mockQuery.mockResolvedValue({ rows: [baseRow] });
    const repo = new PostgresAttemptRepository();
    const result = await repo.findByUser('user-1', 'ex-1');

    expect(result).toHaveLength(1);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('AND a.exercise_id = $2'),
      ['user-1', 'ex-1'],
    );
  });

  it('returns empty array when no attempts match', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const repo = new PostgresAttemptRepository();
    expect(await repo.findByUser('user-1', 'ex-999')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// update — with status and score
// ---------------------------------------------------------------------------

describe('PostgresAttemptRepository.update', () => {
  it('updates status and score and returns the updated Attempt', async () => {
    const updatedRow = { ...baseRow, status: 'incorrect', score: 0 };
    mockQuery.mockResolvedValue({ rows: [updatedRow] });
    const repo = new PostgresAttemptRepository();

    const result = await repo.update('attempt-1', { status: 'incorrect', score: 0 });

    expect(result.status).toBe('incorrect');
    expect(result.score).toBe(0);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE attempts'),
      ['incorrect', 0, 'attempt-1'],
    );
  });

  it('updates only status when score is not provided', async () => {
    const updatedRow = { ...baseRow, status: 'error' };
    mockQuery.mockResolvedValue({ rows: [updatedRow] });
    const repo = new PostgresAttemptRepository();

    const result = await repo.update('attempt-1', { status: 'error' });

    expect(result.status).toBe('error');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('status = $1'),
      ['error', 'attempt-1'],
    );
  });

  it('updates only score when status is not provided', async () => {
    const updatedRow = { ...baseRow, score: 5 };
    mockQuery.mockResolvedValue({ rows: [updatedRow] });
    const repo = new PostgresAttemptRepository();

    const result = await repo.update('attempt-1', { score: 5 });

    expect(result.score).toBe(5);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('score = $1'),
      [5, 'attempt-1'],
    );
  });

  it('returns existing record unchanged when no fields are provided', async () => {
    mockQuery.mockResolvedValue({ rows: [baseRow] });
    const repo = new PostgresAttemptRepository();

    const result = await repo.update('attempt-1', {});

    expect(result).toEqual(expectedAttempt);
    // Should call SELECT, not UPDATE
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('SELECT * FROM attempts WHERE id = $1'),
      ['attempt-1'],
    );
  });
});

// ---------------------------------------------------------------------------
// countByExercise
// ---------------------------------------------------------------------------

describe('PostgresAttemptRepository.countByExercise', () => {
  it('returns the count of attempts for an exercise', async () => {
    mockQuery.mockResolvedValue({ rows: [{ count: 5 }] });
    const repo = new PostgresAttemptRepository();
    const result = await repo.countByExercise('ex-1');

    expect(result).toBe(5);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('WHERE exercise_id = $1'),
      ['ex-1'],
    );
  });

  it('returns 0 when no attempts reference the exercise', async () => {
    mockQuery.mockResolvedValue({ rows: [{ count: 0 }] });
    const repo = new PostgresAttemptRepository();
    expect(await repo.countByExercise('ex-999')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// exercise_title null handling
// ---------------------------------------------------------------------------

describe('PostgresAttemptRepository — exercise_title null', () => {
  it('maps null exercise_title correctly', async () => {
    const rowWithNull = { ...baseRow, exercise_title: null };
    mockQuery.mockResolvedValue({ rows: [rowWithNull] });
    const repo = new PostgresAttemptRepository();
    const result = await repo.findByUser('user-1');
    expect(result[0].exercise_title).toBeNull();
  });
});
