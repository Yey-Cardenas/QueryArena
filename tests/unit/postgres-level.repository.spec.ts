/**
 * Unit tests for PostgresLevelRepository
 * Mocks the `query` helper from database.ts — no real DB required.
 */

import { PostgresLevelRepository } from '../../src/adapters/out/persistence/postgres/PostgresLevelRepository';

jest.mock('../../src/infrastructure/database', () => ({
  query: jest.fn(),
}));

import { query } from '../../src/infrastructure/database';
const mockQuery = query as jest.Mock;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const row1 = { id: 1, name: 'Básico',      created_at: new Date('2024-01-01') };
const row2 = { id: 2, name: 'Intermedio',  created_at: new Date('2024-01-02') };
const row3 = { id: 3, name: 'Avanzado',    created_at: new Date('2024-01-03') };

beforeEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// findAll
// ---------------------------------------------------------------------------

describe('PostgresLevelRepository.findAll', () => {
  it('returns all levels mapped from rows', async () => {
    mockQuery.mockResolvedValue({ rows: [row1, row2, row3] });
    const repo = new PostgresLevelRepository();
    const result = await repo.findAll();
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ id: 1, name: 'Básico',     created_at: row1.created_at });
    expect(result[2]).toEqual({ id: 3, name: 'Avanzado',   created_at: row3.created_at });
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('SELECT id, name, created_at FROM levels'),
    );
  });

  it('returns empty array when table is empty', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const repo = new PostgresLevelRepository();
    expect(await repo.findAll()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// findById
// ---------------------------------------------------------------------------

describe('PostgresLevelRepository.findById', () => {
  it('returns a Level when row exists', async () => {
    mockQuery.mockResolvedValue({ rows: [row1] });
    const repo = new PostgresLevelRepository();
    const result = await repo.findById(1);
    expect(result).toEqual({ id: 1, name: 'Básico', created_at: row1.created_at });
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('WHERE id = $1'),
      [1],
    );
  });

  it('returns null when no row exists', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const repo = new PostgresLevelRepository();
    expect(await repo.findById(999)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// findByName
// ---------------------------------------------------------------------------

describe('PostgresLevelRepository.findByName', () => {
  it('returns a Level when row exists', async () => {
    mockQuery.mockResolvedValue({ rows: [row1] });
    const repo = new PostgresLevelRepository();
    const result = await repo.findByName('Básico');
    expect(result).toEqual({ id: 1, name: 'Básico', created_at: row1.created_at });
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('WHERE name = $1'),
      ['Básico'],
    );
  });

  it('returns null when no row exists', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const repo = new PostgresLevelRepository();
    expect(await repo.findByName('UNKNOWN')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

describe('PostgresLevelRepository.create', () => {
  it('inserts and returns the created Level', async () => {
    mockQuery.mockResolvedValue({ rows: [row1] });
    const repo = new PostgresLevelRepository();
    const result = await repo.create('Básico');
    expect(result).toEqual({ id: 1, name: 'Básico', created_at: row1.created_at });
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO levels'),
      ['Básico'],
    );
  });
});

// ---------------------------------------------------------------------------
// update
// ---------------------------------------------------------------------------

describe('PostgresLevelRepository.update', () => {
  it('updates and returns the updated Level', async () => {
    const updatedRow = { id: 1, name: 'Básico+', created_at: row1.created_at };
    mockQuery.mockResolvedValue({ rows: [updatedRow] });
    const repo = new PostgresLevelRepository();
    const result = await repo.update(1, 'Básico+');
    expect(result.name).toBe('Básico+');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE levels'),
      ['Básico+', 1],
    );
  });

  it('throws when level is not found', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const repo = new PostgresLevelRepository();
    await expect(repo.update(999, 'X')).rejects.toThrow('Level with id 999 not found');
  });
});

// ---------------------------------------------------------------------------
// delete
// ---------------------------------------------------------------------------

describe('PostgresLevelRepository.delete', () => {
  it('calls DELETE with the correct id', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const repo = new PostgresLevelRepository();
    await repo.delete(1);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM levels'),
      [1],
    );
  });
});
