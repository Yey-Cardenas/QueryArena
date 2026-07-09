/**
 * Unit tests for PostgresRankingRepository
 * Mocks the `query` helper from infrastructure/database so no real DB is needed.
 */

import { PostgresRankingRepository } from '../../src/adapters/out/persistence/postgres/PostgresRankingRepository';

// ── Mock database ─────────────────────────────────────────────────────────────
jest.mock('../../src/infrastructure/database', () => ({
  query: jest.fn(),
}));

import { query } from '../../src/infrastructure/database';
const mockQuery = query as jest.Mock;

// ── Fixtures ──────────────────────────────────────────────────────────────────
const now = new Date('2024-01-15T10:00:00Z');

// node-pg returns numeric columns as strings
const rankingRow = {
  id:                'rank-uuid-1',
  user_id:           'u-uuid-1',
  accumulated_score: '150',       // string — as pg returns it
  last_correct_at:   now,
  updated_at:        now,
};

const rankingRowWithUsername = {
  ...rankingRow,
  username: 'alice',
};

const rankingRow2 = {
  id:                'rank-uuid-2',
  user_id:           'u-uuid-2',
  accumulated_score: '80',
  last_correct_at:   null,
  updated_at:        now,
  username:          'bob',
};

function makeResult(rows: object[]) {
  return { rows };
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('PostgresRankingRepository', () => {
  let repo: PostgresRankingRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new PostgresRankingRepository();
  });

  // ── upsert ────────────────────────────────────────────────────────────────

  describe('upsert', () => {
    it('calls INSERT … ON CONFLICT with userId and scoreIncrement', async () => {
      mockQuery.mockResolvedValue(makeResult([]));

      await repo.upsert('u-uuid-1', 50);

      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT'),
        ['u-uuid-1', 50],
      );
    });

    it('calls upsert with score = 0 without throwing', async () => {
      mockQuery.mockResolvedValue(makeResult([]));
      await expect(repo.upsert('u-uuid-1', 0)).resolves.toBeUndefined();
    });
  });

  // ── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns all ranking entries with username, score parsed as number', async () => {
      mockQuery.mockResolvedValue(makeResult([rankingRowWithUsername, rankingRow2]));

      const result = await repo.findAll();

      expect(result).toHaveLength(2);

      expect(result[0].id).toBe('rank-uuid-1');
      expect(result[0].username).toBe('alice');
      expect(result[0].accumulated_score).toBe(150);   // parsed int
      expect(result[0].last_correct_at).toEqual(now);

      expect(result[1].id).toBe('rank-uuid-2');
      expect(result[1].username).toBe('bob');
      expect(result[1].accumulated_score).toBe(80);
      expect(result[1].last_correct_at).toBeNull();
    });

    it('returns empty array when ranking table is empty', async () => {
      mockQuery.mockResolvedValue(makeResult([]));
      const result = await repo.findAll();
      expect(result).toEqual([]);
    });

    it('queries with ORDER BY accumulated_score DESC', async () => {
      mockQuery.mockResolvedValue(makeResult([]));
      await repo.findAll();
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY r.accumulated_score DESC'),
      );
    });
  });

  // ── findByUser ────────────────────────────────────────────────────────────

  describe('findByUser', () => {
    it('returns the ranking entry for the given user', async () => {
      mockQuery.mockResolvedValue(makeResult([rankingRow]));

      const result = await repo.findByUser('u-uuid-1');

      expect(result).not.toBeNull();
      expect(result!.user_id).toBe('u-uuid-1');
      expect(result!.accumulated_score).toBe(150);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE user_id = $1'),
        ['u-uuid-1'],
      );
    });

    it('returns null when user has no ranking entry', async () => {
      mockQuery.mockResolvedValue(makeResult([]));
      const result = await repo.findByUser('u-uuid-999');
      expect(result).toBeNull();
    });

    it('handles null last_correct_at correctly', async () => {
      const rowNullDate = { ...rankingRow, last_correct_at: null };
      mockQuery.mockResolvedValue(makeResult([rowNullDate]));

      const result = await repo.findByUser('u-uuid-1');
      expect(result!.last_correct_at).toBeNull();
    });
  });
});
