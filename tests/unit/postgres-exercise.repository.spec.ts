/**
 * Unit tests for PostgresExerciseRepository
 * Mocks the `query` helper from database.ts — no real DB required.
 */

import { PostgresExerciseRepository } from '../../src/adapters/out/persistence/postgres/PostgresExerciseRepository';

jest.mock('../../src/infrastructure/database', () => ({
  query: jest.fn(),
}));

import { query } from '../../src/infrastructure/database';
const mockQuery = query as jest.Mock;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseRow = {
  id: 'ex-1',
  title: 'Select all users',
  description: 'Write a SELECT * query',
  expected_solution: 'SELECT * FROM users',
  score: 10,
  is_active: true,
  level_id: 1,
  category_id: 2,
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-01-02'),
  level_name: 'Básico',
  level_created_at: new Date('2024-01-01'),
  category_name: 'SELECT',
  category_created_at: new Date('2024-01-01'),
};

const expectedExercise = {
  id: 'ex-1',
  title: 'Select all users',
  description: 'Write a SELECT * query',
  expected_solution: 'SELECT * FROM users',
  score: 10,
  is_active: true,
  level_id: 1,
  category_id: 2,
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-01-02'),
  level: { id: 1, name: 'Básico', created_at: new Date('2024-01-01') },
  category: { id: 2, name: 'SELECT', created_at: new Date('2024-01-01') },
};

beforeEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// findAll
// ---------------------------------------------------------------------------

describe('PostgresExerciseRepository.findAll', () => {
  it('returns all exercises with no filters', async () => {
    mockQuery.mockResolvedValue({ rows: [baseRow] });
    const repo = new PostgresExerciseRepository();
    const result = await repo.findAll();

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(expectedExercise);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY e.created_at DESC'),
      [],
    );
  });

  it('filters by level_id when provided', async () => {
    mockQuery.mockResolvedValue({ rows: [baseRow] });
    const repo = new PostgresExerciseRepository();
    await repo.findAll({ level_id: 1 });

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('e.level_id = $1'),
      [1],
    );
  });

  it('filters by category_id when provided', async () => {
    mockQuery.mockResolvedValue({ rows: [baseRow] });
    const repo = new PostgresExerciseRepository();
    await repo.findAll({ category_id: 2 });

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('e.category_id = $1'),
      [2],
    );
  });

  it('filters by both level_id and category_id', async () => {
    mockQuery.mockResolvedValue({ rows: [baseRow] });
    const repo = new PostgresExerciseRepository();
    await repo.findAll({ level_id: 1, category_id: 2 });

    const callArgs = mockQuery.mock.calls[0];
    expect(callArgs[0]).toContain('e.level_id = $1');
    expect(callArgs[0]).toContain('e.category_id = $2');
    expect(callArgs[1]).toEqual([1, 2]);
  });

  it('returns empty array when no exercises exist', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const repo = new PostgresExerciseRepository();
    expect(await repo.findAll()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// findById
// ---------------------------------------------------------------------------

describe('PostgresExerciseRepository.findById', () => {
  it('returns an Exercise when row exists', async () => {
    mockQuery.mockResolvedValue({ rows: [baseRow] });
    const repo = new PostgresExerciseRepository();
    const result = await repo.findById('ex-1');

    expect(result).toEqual(expectedExercise);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('WHERE e.id = $1'),
      ['ex-1'],
    );
  });

  it('returns null when exercise does not exist', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const repo = new PostgresExerciseRepository();
    expect(await repo.findById('nonexistent')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

describe('PostgresExerciseRepository.create', () => {
  it('inserts and re-fetches the created Exercise', async () => {
    // First call: INSERT RETURNING id
    // Second call: findById SELECT
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'ex-1' }] })
      .mockResolvedValueOnce({ rows: [baseRow] });

    const repo = new PostgresExerciseRepository();
    const result = await repo.create({
      title: 'Select all users',
      description: 'Write a SELECT * query',
      expected_solution: 'SELECT * FROM users',
      score: 10,
      is_active: true,
      level_id: 1,
      category_id: 2,
      level: { id: 1, name: 'Básico', created_at: new Date('2024-01-01') },
      category: { id: 2, name: 'SELECT', created_at: new Date('2024-01-01') },
    });

    expect(result).toEqual(expectedExercise);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO exercises'),
      expect.arrayContaining(['Select all users', 'SELECT * FROM users', 10, true, 1, 2]),
    );
  });

  it('throws when re-fetch after insert returns nothing', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'ex-new' }] })
      .mockResolvedValueOnce({ rows: [] });

    const repo = new PostgresExerciseRepository();
    await expect(repo.create({
      title: 'T', description: 'D', expected_solution: 'S',
      score: 5, is_active: true, level_id: 1, category_id: 1,
      level: { id: 1, name: 'L', created_at: new Date() },
      category: { id: 1, name: 'C', created_at: new Date() },
    })).rejects.toThrow('Failed to retrieve exercise after insert');
  });
});

// ---------------------------------------------------------------------------
// update
// ---------------------------------------------------------------------------

describe('PostgresExerciseRepository.update', () => {
  it('updates provided fields and re-fetches the Exercise', async () => {
    // First call: UPDATE, second call: findById SELECT
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ ...baseRow, title: 'Updated title' }] });

    const repo = new PostgresExerciseRepository();
    const result = await repo.update('ex-1', { title: 'Updated title' });

    expect(result.title).toBe('Updated title');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE exercises'),
      expect.arrayContaining(['Updated title', 'ex-1']),
    );
  });

  it('always includes updated_at = NOW() in SET clause', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [baseRow] });

    const repo = new PostgresExerciseRepository();
    await repo.update('ex-1', { score: 20 });

    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain('updated_at = NOW()');
  });

  it('updates multiple fields correctly', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [baseRow] });

    const repo = new PostgresExerciseRepository();
    await repo.update('ex-1', { title: 'New', score: 20, is_active: false });

    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain('title = $1');
    expect(sql).toContain('score = $2');
    expect(sql).toContain('is_active = $3');
    expect(params).toContain('New');
    expect(params).toContain(20);
    expect(params).toContain(false);
  });

  it('throws when re-fetch after update returns nothing', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const repo = new PostgresExerciseRepository();
    await expect(repo.update('ghost', { title: 'X' })).rejects.toThrow(
      'Exercise not found after update',
    );
  });
});

// ---------------------------------------------------------------------------
// delete
// ---------------------------------------------------------------------------

describe('PostgresExerciseRepository.delete', () => {
  it('calls DELETE with the correct id', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const repo = new PostgresExerciseRepository();
    await repo.delete('ex-1');

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM exercises WHERE id = $1'),
      ['ex-1'],
    );
  });
});

// ---------------------------------------------------------------------------
// countByLevel
// ---------------------------------------------------------------------------

describe('PostgresExerciseRepository.countByLevel', () => {
  it('returns the count of exercises for a level', async () => {
    mockQuery.mockResolvedValue({ rows: [{ count: 3 }] });
    const repo = new PostgresExerciseRepository();
    const result = await repo.countByLevel(1);

    expect(result).toBe(3);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('WHERE level_id = $1'),
      [1],
    );
  });

  it('returns 0 when no exercises belong to the level', async () => {
    mockQuery.mockResolvedValue({ rows: [{ count: 0 }] });
    const repo = new PostgresExerciseRepository();
    expect(await repo.countByLevel(999)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// countByCategory
// ---------------------------------------------------------------------------

describe('PostgresExerciseRepository.countByCategory', () => {
  it('returns the count of exercises for a category', async () => {
    mockQuery.mockResolvedValue({ rows: [{ count: 7 }] });
    const repo = new PostgresExerciseRepository();
    const result = await repo.countByCategory(2);

    expect(result).toBe(7);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('WHERE category_id = $1'),
      [2],
    );
  });

  it('returns 0 when no exercises belong to the category', async () => {
    mockQuery.mockResolvedValue({ rows: [{ count: 0 }] });
    const repo = new PostgresExerciseRepository();
    expect(await repo.countByCategory(999)).toBe(0);
  });
});
