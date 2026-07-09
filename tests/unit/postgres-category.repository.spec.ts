/**
 * Unit tests for PostgresCategoryRepository
 * Mocks the `query` helper from database.ts — no real DB required.
 */

import { PostgresCategoryRepository } from '../../src/adapters/out/persistence/postgres/PostgresCategoryRepository';

jest.mock('../../src/infrastructure/database', () => ({
  query: jest.fn(),
}));

import { query } from '../../src/infrastructure/database';
const mockQuery = query as jest.Mock;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const row1 = { id: 1, name: 'SELECT', created_at: new Date('2024-01-01') };
const row2 = { id: 2, name: 'JOIN',   created_at: new Date('2024-01-02') };

beforeEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// findAll
// ---------------------------------------------------------------------------

describe('PostgresCategoryRepository.findAll', () => {
  it('returns all categories mapped from rows', async () => {
    mockQuery.mockResolvedValue({ rows: [row1, row2] });
    const repo = new PostgresCategoryRepository();
    const result = await repo.findAll();
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: 1, name: 'SELECT', created_at: row1.created_at });
    expect(result[1]).toEqual({ id: 2, name: 'JOIN',   created_at: row2.created_at });
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('SELECT id, name, created_at FROM categories'),
    );
  });

  it('returns empty array when table is empty', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const repo = new PostgresCategoryRepository();
    expect(await repo.findAll()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// findById
// ---------------------------------------------------------------------------

describe('PostgresCategoryRepository.findById', () => {
  it('returns a Category when row exists', async () => {
    mockQuery.mockResolvedValue({ rows: [row1] });
    const repo = new PostgresCategoryRepository();
    const result = await repo.findById(1);
    expect(result).toEqual({ id: 1, name: 'SELECT', created_at: row1.created_at });
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('WHERE id = $1'),
      [1],
    );
  });

  it('returns null when no row exists', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const repo = new PostgresCategoryRepository();
    expect(await repo.findById(999)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// findByName
// ---------------------------------------------------------------------------

describe('PostgresCategoryRepository.findByName', () => {
  it('returns a Category when row exists', async () => {
    mockQuery.mockResolvedValue({ rows: [row1] });
    const repo = new PostgresCategoryRepository();
    const result = await repo.findByName('SELECT');
    expect(result).toEqual({ id: 1, name: 'SELECT', created_at: row1.created_at });
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('WHERE name = $1'),
      ['SELECT'],
    );
  });

  it('returns null when no row exists', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const repo = new PostgresCategoryRepository();
    expect(await repo.findByName('UNKNOWN')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

describe('PostgresCategoryRepository.create', () => {
  it('inserts and returns the created Category', async () => {
    mockQuery.mockResolvedValue({ rows: [row1] });
    const repo = new PostgresCategoryRepository();
    const result = await repo.create('SELECT');
    expect(result).toEqual({ id: 1, name: 'SELECT', created_at: row1.created_at });
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO categories'),
      ['SELECT'],
    );
  });
});

// ---------------------------------------------------------------------------
// update
// ---------------------------------------------------------------------------

describe('PostgresCategoryRepository.update', () => {
  it('updates and returns the updated Category', async () => {
    const updatedRow = { id: 1, name: 'SELECT *', created_at: row1.created_at };
    mockQuery.mockResolvedValue({ rows: [updatedRow] });
    const repo = new PostgresCategoryRepository();
    const result = await repo.update(1, 'SELECT *');
    expect(result.name).toBe('SELECT *');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE categories'),
      ['SELECT *', 1],
    );
  });

  it('throws when category is not found', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const repo = new PostgresCategoryRepository();
    await expect(repo.update(999, 'X')).rejects.toThrow('Category with id 999 not found');
  });
});

// ---------------------------------------------------------------------------
// delete
// ---------------------------------------------------------------------------

describe('PostgresCategoryRepository.delete', () => {
  it('calls DELETE with the correct id', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const repo = new PostgresCategoryRepository();
    await repo.delete(1);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM categories'),
      [1],
    );
  });
});
