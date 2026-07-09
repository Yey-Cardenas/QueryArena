/**
 * Unit tests for PostgresExerciseRepository
 * Mocks the `query` helper from infrastructure/database so no real DB is needed.
 *
 * Notes:
 *  - create() inserts and then calls findById() internally → mockQuery called twice.
 *  - update() calls UPDATE and then findById() internally → mockQuery called twice.
 *  - findById() re-uses the same BASE_SELECT query, so we match on partial strings.
 */

import { PostgresExerciseRepository } from '../../src/adapters/out/persistence/postgres/PostgresExerciseRepository';

// ── Mock database ─────────────────────────────────────────────────────────────
jest.mock('../../src/infrastructure/database', () => ({
  query: jest.fn(),
}));

import { query } from '../../src/infrastructure/database';
const mockQuery = query as jest.Mock;

// ── Fixtures ──────────────────────────────────────────────────────────────────
const now = new Date('2024-01-01T00:00:00Z');

/** Full joined row as returned by BASE_SELECT */
const exerciseRow = {
  id:                  'ex-uuid-1',
  title:               'Select all users',
  description:         'Write a SELECT * query.',
  expected_solution:   'SELECT * FROM users',
  score:               10,
  is_active:           true,
  level_id:            1,
  category_id:         1,
  created_at:          now,
  updated_at:          now,
  level_name:          'Básico',
  level_created_at:    now,
  category_name:       'SELECT',
  category_created_at: now,
};

const exerciseRow2 = {
  ...exerciseRow,
  id:    'ex-uuid-2',
  title: 'Join tables',
  score: 20,
};

function makeResult(rows: object[]) {
  return { rows };
}

/** Expected mapped Exercise domain object */
const mappedExercise = {
  id:                'ex-uuid-1',
  title:             'Select all users',
  description:       'Write a SELECT * query.',
  expected_solution: 'SELECT * FROM users',
  score:             10,
  is_active:         true,
  level_id:          1,
  category_id:       1,
  created_at:        now,
  updated_at:        now,
  level:    { id: 1, name: 'Básico', created_at: now },
  category: { id: 1, name: 'SELECT', created_at: now },
};

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('PostgresExerciseRepository', () => {
  let repo: PostgresExerciseRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new PostgresExerciseRepository();
  });

  // ── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns all exercises with no filters', async () => {
      mockQuery.mockResolvedValue(makeResult([exerciseRow, exerciseRow2]));

      const result = await repo.findAll();

      expect(result).toHaveLength(2);
      const first = result[0]!;
      expect(first.id).toBe('ex-uuid-1');
      expect(first.level!.name).toBe('Básico');
      expect(first.category!.name).toBe('SELECT');
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('returns empty array when no exercises exist', async () => {
      mockQuery.mockResolvedValue(makeResult([]));
      const result = await repo.findAll();
      expect(result).toEqual([]);
    });

    it('applies level_id filter', async () => {
      mockQuery.mockResolvedValue(makeResult([exerciseRow]));

      await repo.findAll({ level_id: 1 });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('e.level_id = $1'),
        [1],
      );
    });

    it('applies category_id filter', async () => {
      mockQuery.mockResolvedValue(makeResult([exerciseRow]));

      await repo.findAll({ category_id: 1 });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('e.category_id = $1'),
        [1],
      );
    });

    it('applies both level_id and category_id filters', async () => {
      mockQuery.mockResolvedValue(makeResult([exerciseRow]));

      await repo.findAll({ level_id: 1, category_id: 1 });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('e.level_id = $1'),
        [1, 1],
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('e.category_id = $2'),
        [1, 1],
      );
    });
  });

  // ── findById ──────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('returns the exercise when found', async () => {
      mockQuery.mockResolvedValue(makeResult([exerciseRow]));

      const result = await repo.findById('ex-uuid-1');

      expect(result).toEqual(mappedExercise);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE e.id = $1'),
        ['ex-uuid-1'],
      );
    });

    it('returns null when exercise not found', async () => {
      mockQuery.mockResolvedValue(makeResult([]));
      const result = await repo.findById('nonexistent');
      expect(result).toBeNull();
    });
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('inserts the exercise and re-fetches via findById', async () => {
      // First call: INSERT RETURNING id
      // Second call: findById (BASE_SELECT WHERE e.id = $1)
      mockQuery
        .mockResolvedValueOnce(makeResult([{ id: 'ex-uuid-1' }]))
        .mockResolvedValueOnce(makeResult([exerciseRow]));

      const result = await repo.create({
        title:             'Select all users',
        description:       'Write a SELECT * query.',
        expected_solution: 'SELECT * FROM users',
        score:             10,
        is_active:         true,
        level_id:          1,
        category_id:       1,
        level:    { id: 1, name: 'Básico', created_at: now },
        category: { id: 1, name: 'SELECT', created_at: now },
      });

      expect(mockQuery).toHaveBeenCalledTimes(2);
      expect(result).toEqual(mappedExercise);

      // First call: INSERT
      expect(mockQuery.mock.calls[0][0]).toContain('INSERT INTO exercises');
      // Second call: findById
      expect(mockQuery.mock.calls[1][0]).toContain('WHERE e.id = $1');
    });

    it('throws when findById returns null after insert', async () => {
      mockQuery
        .mockResolvedValueOnce(makeResult([{ id: 'ex-uuid-missing' }]))
        .mockResolvedValueOnce(makeResult([])); // findById returns nothing

      await expect(repo.create({
        title: 'X', description: 'X', expected_solution: 'X',
        score: 1, is_active: true, level_id: 1, category_id: 1,
        level: { id: 1, name: 'L', created_at: now },
        category: { id: 1, name: 'C', created_at: now },
      })).rejects.toThrow('Failed to retrieve exercise after insert');
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates fields and re-fetches via findById', async () => {
      const updatedRow = { ...exerciseRow, title: 'Updated title', score: 20 };
      // First call: UPDATE
      // Second call: findById
      mockQuery
        .mockResolvedValueOnce(makeResult([]))
        .mockResolvedValueOnce(makeResult([updatedRow]));

      const result = await repo.update('ex-uuid-1', { title: 'Updated title', score: 20 });

      expect(mockQuery).toHaveBeenCalledTimes(2);
      expect(result.title).toBe('Updated title');
      expect(result.score).toBe(20);

      expect(mockQuery.mock.calls[0][0]).toContain('UPDATE exercises');
      expect(mockQuery.mock.calls[1][0]).toContain('WHERE e.id = $1');
    });

    it('throws when findById returns null after update', async () => {
      mockQuery
        .mockResolvedValueOnce(makeResult([]))
        .mockResolvedValueOnce(makeResult([]));

      await expect(repo.update('nonexistent', { title: 'X' }))
        .rejects.toThrow('Exercise not found after update');
    });

    it('updates is_active field', async () => {
      const updatedRow = { ...exerciseRow, is_active: false };
      mockQuery
        .mockResolvedValueOnce(makeResult([]))
        .mockResolvedValueOnce(makeResult([updatedRow]));

      const result = await repo.update('ex-uuid-1', { is_active: false });
      expect(result.is_active).toBe(false);
    });

    it('updates level_id and category_id fields', async () => {
      const updatedRow = { ...exerciseRow, level_id: 2, category_id: 3 };
      mockQuery
        .mockResolvedValueOnce(makeResult([]))
        .mockResolvedValueOnce(makeResult([updatedRow]));

      const result = await repo.update('ex-uuid-1', { level_id: 2, category_id: 3 });
      expect(result.level_id).toBe(2);
      expect(result.category_id).toBe(3);
    });
  });

  // ── delete ────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('calls DELETE with the correct id', async () => {
      mockQuery.mockResolvedValue(makeResult([]));

      await repo.delete('ex-uuid-1');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM exercises'),
        ['ex-uuid-1'],
      );
    });
  });

  // ── countByLevel ──────────────────────────────────────────────────────────

  describe('countByLevel', () => {
    it('returns the count of exercises for a level', async () => {
      mockQuery.mockResolvedValue(makeResult([{ count: 3 }]));

      const result = await repo.countByLevel(1);

      expect(result).toBe(3);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE level_id = $1'),
        [1],
      );
    });

    it('returns 0 when no exercises for the level', async () => {
      mockQuery.mockResolvedValue(makeResult([{ count: 0 }]));
      const result = await repo.countByLevel(999);
      expect(result).toBe(0);
    });
  });

  // ── countByCategory ───────────────────────────────────────────────────────

  describe('countByCategory', () => {
    it('returns the count of exercises for a category', async () => {
      mockQuery.mockResolvedValue(makeResult([{ count: 7 }]));

      const result = await repo.countByCategory(1);

      expect(result).toBe(7);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE category_id = $1'),
        [1],
      );
    });

    it('returns 0 when no exercises for the category', async () => {
      mockQuery.mockResolvedValue(makeResult([{ count: 0 }]));
      const result = await repo.countByCategory(999);
      expect(result).toBe(0);
    });
  });
});
