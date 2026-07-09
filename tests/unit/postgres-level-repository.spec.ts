/**
 * Unit tests for PostgresLevelRepository
 * Mocks the `query` helper from infrastructure/database so no real DB is needed.
 */

import { PostgresLevelRepository } from '../../src/adapters/out/persistence/postgres/PostgresLevelRepository';

// ── Mock database ────────────────────────────────────────────────────────────
jest.mock('../../src/infrastructure/database', () => ({
  query: jest.fn(),
}));

import { query } from '../../src/infrastructure/database';
const mockQuery = query as jest.Mock;

// ── Fixtures ─────────────────────────────────────────────────────────────────
const now = new Date('2024-01-01T00:00:00Z');

const levelRow = { id: 1, name: 'Básico', created_at: now };
const levelRow2 = { id: 2, name: 'Intermedio', created_at: now };

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeResult(rows: object[]) {
  return { rows };
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('PostgresLevelRepository', () => {
  let repo: PostgresLevelRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new PostgresLevelRepository();
  });

  // ── findAll ────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns all levels mapped from rows', async () => {
      mockQuery.mockResolvedValue(makeResult([levelRow, levelRow2]));

      const result = await repo.findAll();

      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: 1, name: 'Básico', created_at: now });
      expect(result[1]).toEqual({ id: 2, name: 'Intermedio', created_at: now });
    });

    it('returns empty array when no rows', async () => {
      mockQuery.mockResolvedValue(makeResult([]));
      const result = await repo.findAll();
      expect(result).toEqual([]);
    });
  });

  // ── findById ──────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('returns the level when found', async () => {
      mockQuery.mockResolvedValue(makeResult([levelRow]));
      const result = await repo.findById(1);
      expect(result).toEqual({ id: 1, name: 'Básico', created_at: now });
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('WHERE id = $1'), [1]);
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValue(makeResult([]));
      const result = await repo.findById(999);
      expect(result).toBeNull();
    });
  });

  // ── findByName ────────────────────────────────────────────────────────────

  describe('findByName', () => {
    it('returns the level when found by name', async () => {
      mockQuery.mockResolvedValue(makeResult([levelRow]));
      const result = await repo.findByName('Básico');
      expect(result).toEqual({ id: 1, name: 'Básico', created_at: now });
      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('WHERE name = $1'), ['Básico']);
    });

    it('returns null when name not found', async () => {
      mockQuery.mockResolvedValue(makeResult([]));
      const result = await repo.findByName('NoExiste');
      expect(result).toBeNull();
    });
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('inserts and returns the new level', async () => {
      mockQuery.mockResolvedValue(makeResult([levelRow]));
      const result = await repo.create('Básico');
      expect(result).toEqual({ id: 1, name: 'Básico', created_at: now });
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO levels'),
        ['Básico'],
      );
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates and returns the modified level', async () => {
      const updated = { id: 1, name: 'Avanzado', created_at: now };
      mockQuery.mockResolvedValue(makeResult([updated]));
      const result = await repo.update(1, 'Avanzado');
      expect(result).toEqual(updated);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE levels'),
        ['Avanzado', 1],
      );
    });

    it('throws when level not found', async () => {
      mockQuery.mockResolvedValue(makeResult([]));
      await expect(repo.update(999, 'NoExiste')).rejects.toThrow('Level with id 999 not found');
    });
  });

  // ── delete ────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('calls DELETE with the correct id', async () => {
      mockQuery.mockResolvedValue(makeResult([]));
      await repo.delete(1);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM levels'),
        [1],
      );
    });
  });
});
