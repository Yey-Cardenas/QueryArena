/**
 * Unit tests for PostgresCategoryRepository
 * Mocks the `query` helper from infrastructure/database so no real DB is needed.
 */

import { PostgresCategoryRepository } from '../../src/adapters/out/persistence/postgres/PostgresCategoryRepository';

// ── Mock database ─────────────────────────────────────────────────────────────
jest.mock('../../src/infrastructure/database', () => ({
  query: jest.fn(),
}));

import { query } from '../../src/infrastructure/database';
const mockQuery = query as jest.Mock;

// ── Fixtures ──────────────────────────────────────────────────────────────────
const now = new Date('2024-01-01T00:00:00Z');

const catRow  = { id: 1, name: 'SELECT', created_at: now };
const catRow2 = { id: 2, name: 'JOIN',   created_at: now };

function makeResult(rows: object[]) {
  return { rows };
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('PostgresCategoryRepository', () => {
  let repo: PostgresCategoryRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new PostgresCategoryRepository();
  });

  // ── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns all categories mapped from rows', async () => {
      mockQuery.mockResolvedValue(makeResult([catRow, catRow2]));

      const result = await repo.findAll();

      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: 1, name: 'SELECT', created_at: now });
      expect(result[1]).toEqual({ id: 2, name: 'JOIN',   created_at: now });
    });

    it('returns empty array when no rows', async () => {
      mockQuery.mockResolvedValue(makeResult([]));
      const result = await repo.findAll();
      expect(result).toEqual([]);
    });
  });

  // ── findById ──────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('returns the category when found', async () => {
      mockQuery.mockResolvedValue(makeResult([catRow]));
      const result = await repo.findById(1);
      expect(result).toEqual({ id: 1, name: 'SELECT', created_at: now });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $1'),
        [1],
      );
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue(makeResult([]));
      const result = await repo.findById(999);
      expect(result).toBeNull();
    });
  });

  // ── findByName ────────────────────────────────────────────────────────────

  describe('findByName', () => {
    it('returns the category when found by name', async () => {
      mockQuery.mockResolvedValue(makeResult([catRow]));
      const result = await repo.findByName('SELECT');
      expect(result).toEqual({ id: 1, name: 'SELECT', created_at: now });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE name = $1'),
        ['SELECT'],
      );
    });

    it('returns null when name not found', async () => {
      mockQuery.mockResolvedValue(makeResult([]));
      const result = await repo.findByName('NoExiste');
      expect(result).toBeNull();
    });
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('inserts and returns the new category', async () => {
      mockQuery.mockResolvedValue(makeResult([catRow]));
      const result = await repo.create('SELECT');
      expect(result).toEqual({ id: 1, name: 'SELECT', created_at: now });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO categories'),
        ['SELECT'],
      );
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates and returns the modified category', async () => {
      const updated = { id: 1, name: 'DML', created_at: now };
      mockQuery.mockResolvedValue(makeResult([updated]));
      const result = await repo.update(1, 'DML');
      expect(result).toEqual(updated);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE categories'),
        ['DML', 1],
      );
    });

    it('throws when category not found', async () => {
      mockQuery.mockResolvedValue(makeResult([]));
      await expect(repo.update(999, 'NoExiste')).rejects.toThrow(
        'Category with id 999 not found',
      );
    });
  });

  // ── delete ────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('calls DELETE with the correct id', async () => {
      mockQuery.mockResolvedValue(makeResult([]));
      await repo.delete(1);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM categories'),
        [1],
      );
    });
  });
});
