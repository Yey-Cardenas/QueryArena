/**
 * Unit tests for PostgresAttemptRepository
 * Mocks the `query` helper from infrastructure/database so no real DB is needed.
 */

import { PostgresAttemptRepository } from '../../src/adapters/out/persistence/postgres/PostgresAttemptRepository';
import type { Attempt } from '../../src/domain/entities/Attempt';

// ── Mock database ─────────────────────────────────────────────────────────────
jest.mock('../../src/infrastructure/database', () => ({
  query: jest.fn(),
}));

import { query } from '../../src/infrastructure/database';
const mockQuery = query as jest.Mock;

// ── Fixtures ──────────────────────────────────────────────────────────────────
const now = new Date('2024-01-15T10:00:00Z');

const attemptRow = {
  id:                 'att-uuid-1',
  user_id:            'u-uuid-1',
  exercise_id:        'ex-uuid-1',
  exercise_title:     'Select all users',
  query_sent:         'SELECT * FROM users',
  status:             'correct',
  score:              10,
  resolution_time_ms: 1500,
  created_at:         now,
};

const attemptRow2 = {
  ...attemptRow,
  id:     'att-uuid-2',
  status: 'incorrect',
  score:  0,
};

function makeResult(rows: object[]) {
  return { rows };
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('PostgresAttemptRepository', () => {
  let repo: PostgresAttemptRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new PostgresAttemptRepository();
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('inserts and returns the created attempt', async () => {
      mockQuery.mockResolvedValue(makeResult([attemptRow]));

      const result = await repo.create({
        user_id:            'u-uuid-1',
        exercise_id:        'ex-uuid-1',
        query_sent:         'SELECT * FROM users',
        status:             'correct',
        score:              10,
        resolution_time_ms: 1500,
      });

      expect(result.id).toBe('att-uuid-1');
      expect(result.status).toBe('correct');
      expect(result.score).toBe(10);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO attempts'),
        ['u-uuid-1', 'ex-uuid-1', 'SELECT * FROM users', 'correct', 10, 1500],
      );
    });

    it('maps exercise_title from the joined row', async () => {
      mockQuery.mockResolvedValue(makeResult([attemptRow]));
      const result = await repo.create({
        user_id: 'u-uuid-1', exercise_id: 'ex-uuid-1',
        query_sent: 'SELECT 1', status: 'correct', score: 10, resolution_time_ms: 500,
      }) as Attempt & { exercise_title?: string | null };
      expect(result.exercise_title).toBe('Select all users');
    });
  });

  // ── findByUser ────────────────────────────────────────────────────────────

  describe('findByUser', () => {
    it('returns all attempts for a user (no exercise filter)', async () => {
      mockQuery.mockResolvedValue(makeResult([attemptRow, attemptRow2]));

      const result = await repo.findByUser('u-uuid-1');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('att-uuid-1');
      expect(result[1].id).toBe('att-uuid-2');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE a.user_id = $1'),
        ['u-uuid-1'],
      );
    });

    it('returns empty array when user has no attempts', async () => {
      mockQuery.mockResolvedValue(makeResult([]));
      const result = await repo.findByUser('u-uuid-99');
      expect(result).toEqual([]);
    });

    it('filters by exerciseId when provided', async () => {
      mockQuery.mockResolvedValue(makeResult([attemptRow]));

      const result = await repo.findByUser('u-uuid-1', 'ex-uuid-1');

      expect(result).toHaveLength(1);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('AND a.exercise_id = $2'),
        ['u-uuid-1', 'ex-uuid-1'],
      );
    });

    it('returns empty array when no attempts match the exercise filter', async () => {
      mockQuery.mockResolvedValue(makeResult([]));
      const result = await repo.findByUser('u-uuid-1', 'ex-uuid-999');
      expect(result).toEqual([]);
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates status and score and returns the updated attempt', async () => {
      const updated = { ...attemptRow, status: 'incorrect', score: 0 };
      mockQuery.mockResolvedValue(makeResult([updated]));

      const result = await repo.update('att-uuid-1', { status: 'incorrect', score: 0 });

      expect(result.status).toBe('incorrect');
      expect(result.score).toBe(0);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE attempts'),
        ['incorrect', 0, 'att-uuid-1'],
      );
    });

    it('updates only status when score is not provided', async () => {
      const updated = { ...attemptRow, status: 'error' };
      mockQuery.mockResolvedValue(makeResult([updated]));

      const result = await repo.update('att-uuid-1', { status: 'error' });

      expect(result.status).toBe('error');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE attempts'),
        ['error', 'att-uuid-1'],
      );
    });

    it('updates only score when status is not provided', async () => {
      const updated = { ...attemptRow, score: 5 };
      mockQuery.mockResolvedValue(makeResult([updated]));

      const result = await repo.update('att-uuid-1', { score: 5 });

      expect(result.score).toBe(5);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE attempts'),
        [5, 'att-uuid-1'],
      );
    });

    it('returns existing attempt unchanged when no fields are provided', async () => {
      mockQuery.mockResolvedValue(makeResult([attemptRow]));

      const result = await repo.update('att-uuid-1', {});

      // With empty data, falls back to SELECT * FROM attempts WHERE id = $1
      expect(result.id).toBe('att-uuid-1');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM attempts WHERE id = $1'),
        ['att-uuid-1'],
      );
    });
  });

  // ── countByExercise ───────────────────────────────────────────────────────

  describe('countByExercise', () => {
    it('returns the count of attempts for an exercise', async () => {
      mockQuery.mockResolvedValue(makeResult([{ count: 5 }]));

      const result = await repo.countByExercise('ex-uuid-1');

      expect(result).toBe(5);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(*)'),
        ['ex-uuid-1'],
      );
    });

    it('returns 0 when there are no attempts', async () => {
      mockQuery.mockResolvedValue(makeResult([{ count: 0 }]));
      const result = await repo.countByExercise('ex-uuid-999');
      expect(result).toBe(0);
    });
  });
});
