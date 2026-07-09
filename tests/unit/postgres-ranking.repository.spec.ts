/**
 * Unit tests for PostgresRankingRepository
 * Mocks the `query` helper from database.ts — no real DB required.
 */

import { PostgresRankingRepository } from '../../src/adapters/out/persistence/postgres/PostgresRankingRepository';

jest.mock('../../src/infrastructure/database', () => ({
  query: jest.fn(),
}));

import { query } from '../../src/infrastructure/database';
const mockQuery = query as jest.Mock;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const rankingRow = {
  id: 'ranking-1',
  user_id: 'user-1',
  accumulated_score: '150',      // PostgreSQL returns numeric as string
  last_correct_at: new Date('2024-06-01'),
  updated_at: new Date('2024-06-02'),
  username: 'alice',
};

const expectedRanking = {
  id: 'ranking-1',
  user_id: 'user-1',
  accumulated_score: 150,
  last_correct_at: new Date('2024-06-01'),
  updated_at: new Date('2024-06-02'),
};

beforeEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// upsert
// ---------------------------------------------------------------------------

describe('PostgresRankingRepository.upsert', () => {
  it('calls INSERT … ON CONFLICT with userId and scoreIncrement', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const repo = new PostgresRankingRepository();
    await repo.upsert('user-1', 10);

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT (user_id) DO UPDATE'),
      ['user-1', 10],
    );
  });

  it('resolves without returning a value', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const repo = new PostgresRankingRepository();
    await expect(repo.upsert('user-2', 20)).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// findAll
// ---------------------------------------------------------------------------

describe('PostgresRankingRepository.findAll', () => {
  it('returns all ranking entries with username, ordered by score', async () => {
    const row2 = {
      id: 'ranking-2',
      user_id: 'user-2',
      accumulated_score: '80',
      last_correct_at: new Date('2024-05-01'),
      updated_at: new Date('2024-05-02'),
      username: 'bob',
    };
    mockQuery.mockResolvedValue({ rows: [rankingRow, row2] });
    const repo = new PostgresRankingRepository();
    const result = await repo.findAll();

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ ...expectedRanking, username: 'alice' });
    expect(result[1]).toEqual({
      id: 'ranking-2',
      user_id: 'user-2',
      accumulated_score: 80,
      last_correct_at: new Date('2024-05-01'),
      updated_at: new Date('2024-05-02'),
      username: 'bob',
    });
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY r.accumulated_score DESC'),
    );
  });

  it('returns empty array when no rankings exist', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const repo = new PostgresRankingRepository();
    expect(await repo.findAll()).toEqual([]);
  });

  it('parses accumulated_score string to integer', async () => {
    mockQuery.mockResolvedValue({ rows: [{ ...rankingRow, accumulated_score: '999' }] });
    const repo = new PostgresRankingRepository();
    const result = await repo.findAll();
    expect(result[0].accumulated_score).toBe(999);
    expect(typeof result[0].accumulated_score).toBe('number');
  });

  it('includes username from JOIN', async () => {
    mockQuery.mockResolvedValue({ rows: [rankingRow] });
    const repo = new PostgresRankingRepository();
    const result = await repo.findAll();
    expect(result[0].username).toBe('alice');
  });
});

// ---------------------------------------------------------------------------
// findByUser
// ---------------------------------------------------------------------------

describe('PostgresRankingRepository.findByUser', () => {
  it('returns a Ranking when a row exists for the user', async () => {
    mockQuery.mockResolvedValue({ rows: [rankingRow] });
    const repo = new PostgresRankingRepository();
    const result = await repo.findByUser('user-1');

    expect(result).toEqual(expectedRanking);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('WHERE user_id = $1'),
      ['user-1'],
    );
  });

  it('returns null when no row exists for the user', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const repo = new PostgresRankingRepository();
    expect(await repo.findByUser('user-new')).toBeNull();
  });

  it('handles null last_correct_at', async () => {
    mockQuery.mockResolvedValue({
      rows: [{ ...rankingRow, last_correct_at: null }],
    });
    const repo = new PostgresRankingRepository();
    const result = await repo.findByUser('user-1');
    expect(result!.last_correct_at).toBeNull();
  });
});
