/**
 * Unit tests for ExerciseUseCase
 * IExerciseRepository is mocked with jest.fn() — no real database.
 *
 * Requirements covered: 4.1, 4.2, 4.3, 4.5
 */

import { ExerciseUseCase } from '../../src/domain/use-cases/ExerciseUseCase';
import type { IExerciseRepository } from '../../src/domain/ports/out/IExerciseRepository';
import type { Exercise, Level, Category } from '../../src/domain/entities/Exercise';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLevel(overrides: Partial<Level> = {}): Level {
  return {
    id: 1,
    name: 'Básico',
    created_at: new Date('2024-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 1,
    name: 'SELECT',
    created_at: new Date('2024-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'exercise-id-1',
    title: 'Select all users',
    description: 'Write a query to select all users',
    expected_solution: 'SELECT * FROM users;',
    score: 10,
    is_active: true,
    level_id: 1,
    category_id: 1,
    created_at: new Date('2024-01-01T00:00:00.000Z'),
    updated_at: new Date('2024-01-01T00:00:00.000Z'),
    level: makeLevel(),
    category: makeCategory(),
    ...overrides,
  };
}

function makeMocks() {
  const exerciseRepository: jest.Mocked<IExerciseRepository> = {
    findAll: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    countByLevel: jest.fn(),
    countByCategory: jest.fn(),
  };

  const useCase = new ExerciseUseCase(exerciseRepository);

  return { useCase, exerciseRepository };
}

// ---------------------------------------------------------------------------
// listExercises()
// ---------------------------------------------------------------------------

describe('ExerciseUseCase.listExercises()', () => {
  it('1. no filters — repository returns mix of active/inactive → only active exercises returned (Req 4.1)', async () => {
    const { useCase, exerciseRepository } = makeMocks();

    const activeExercise1 = makeExercise({ id: 'ex-1', title: 'Active 1', is_active: true });
    const inactiveExercise = makeExercise({ id: 'ex-2', title: 'Inactive', is_active: false });
    const activeExercise2 = makeExercise({ id: 'ex-3', title: 'Active 2', is_active: true });

    exerciseRepository.findAll.mockResolvedValue([activeExercise1, inactiveExercise, activeExercise2]);

    const result = await useCase.listExercises();

    expect(result).toHaveLength(2);
    expect(result.map((e) => e.id)).toEqual(['ex-1', 'ex-3']);
    expect(result.every((e) => e.id !== 'ex-2')).toBe(true);
  });

  it('2. no filters — returned summaries contain title, description, level and category (Req 4.1)', async () => {
    const { useCase, exerciseRepository } = makeMocks();

    const level = makeLevel({ id: 2, name: 'Intermedio' });
    const category = makeCategory({ id: 3, name: 'JOIN' });
    const exercise = makeExercise({ id: 'ex-1', title: 'Join query', description: 'Write a JOIN', level, category, level_id: 2, category_id: 3 });

    exerciseRepository.findAll.mockResolvedValue([exercise]);

    const result = await useCase.listExercises();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'ex-1',
      title: 'Join query',
      description: 'Write a JOIN',
      level: { id: 2, name: 'Intermedio' },
      category: { id: 3, name: 'JOIN' },
    });
    // expected_solution must NOT be exposed
    expect(result[0]).not.toHaveProperty('expected_solution');
  });

  it('3. no filters — empty repository → returns empty array (Req 4.1)', async () => {
    const { useCase, exerciseRepository } = makeMocks();

    exerciseRepository.findAll.mockResolvedValue([]);

    const result = await useCase.listExercises();

    expect(result).toEqual([]);
  });

  it('4. filter by level_id — repository called with level_id → only active exercises of that level returned (Req 4.2)', async () => {
    const { useCase, exerciseRepository } = makeMocks();

    const level1 = makeLevel({ id: 1, name: 'Básico' });
    const level2 = makeLevel({ id: 2, name: 'Intermedio' });

    const ex1 = makeExercise({ id: 'ex-1', is_active: true, level_id: 1, level: level1 });
    const ex2 = makeExercise({ id: 'ex-2', is_active: true, level_id: 1, level: level1 });
    // Simulate repository filtering by level; it returns only level 1 exercises
    exerciseRepository.findAll.mockResolvedValue([ex1, ex2]);

    const result = await useCase.listExercises({ level_id: 1 });

    expect(exerciseRepository.findAll).toHaveBeenCalledWith({ level_id: 1, category_id: undefined });
    expect(result).toHaveLength(2);
    expect(result.every((e) => e.level.id === 1)).toBe(true);
    // level2 exercises not in result
    expect(result.find((e) => e.level.id === level2.id)).toBeUndefined();
  });

  it('5. filter by level_id — inactive exercises of that level are excluded (Req 4.2)', async () => {
    const { useCase, exerciseRepository } = makeMocks();

    const level = makeLevel({ id: 1, name: 'Básico' });
    const activeEx = makeExercise({ id: 'ex-1', is_active: true, level_id: 1, level });
    const inactiveEx = makeExercise({ id: 'ex-2', is_active: false, level_id: 1, level });

    exerciseRepository.findAll.mockResolvedValue([activeEx, inactiveEx]);

    const result = await useCase.listExercises({ level_id: 1 });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('ex-1');
  });

  it('6. filter by category_id — repository called with category_id → only active exercises of that category returned (Req 4.3)', async () => {
    const { useCase, exerciseRepository } = makeMocks();

    const catSelect = makeCategory({ id: 1, name: 'SELECT' });
    const catJoin = makeCategory({ id: 2, name: 'JOIN' });

    const ex1 = makeExercise({ id: 'ex-1', is_active: true, category_id: 1, category: catSelect });
    const ex2 = makeExercise({ id: 'ex-2', is_active: true, category_id: 1, category: catSelect });
    // Simulate repository filtering by category; returns only category 1 exercises
    exerciseRepository.findAll.mockResolvedValue([ex1, ex2]);

    const result = await useCase.listExercises({ category_id: 1 });

    expect(exerciseRepository.findAll).toHaveBeenCalledWith({ level_id: undefined, category_id: 1 });
    expect(result).toHaveLength(2);
    expect(result.every((e) => e.category.id === 1)).toBe(true);
    // catJoin exercises not in result
    expect(result.find((e) => e.category.id === catJoin.id)).toBeUndefined();
  });

  it('7. filter by category_id — inactive exercises of that category are excluded (Req 4.3)', async () => {
    const { useCase, exerciseRepository } = makeMocks();

    const category = makeCategory({ id: 2, name: 'JOIN' });
    const activeEx = makeExercise({ id: 'ex-1', is_active: true, category_id: 2, category });
    const inactiveEx = makeExercise({ id: 'ex-2', is_active: false, category_id: 2, category });

    exerciseRepository.findAll.mockResolvedValue([activeEx, inactiveEx]);

    const result = await useCase.listExercises({ category_id: 2 });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('ex-1');
  });

  it('8. all exercises are inactive → returns empty array', async () => {
    const { useCase, exerciseRepository } = makeMocks();

    exerciseRepository.findAll.mockResolvedValue([
      makeExercise({ id: 'ex-1', is_active: false }),
      makeExercise({ id: 'ex-2', is_active: false }),
    ]);

    const result = await useCase.listExercises();

    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getExerciseById()
// ---------------------------------------------------------------------------

describe('ExerciseUseCase.getExerciseById()', () => {
  it('9. existing exercise — findById returns entity → returns detail with enunciado and score (Req 4.4)', async () => {
    const { useCase, exerciseRepository } = makeMocks();

    const exercise = makeExercise({
      id: 'ex-1',
      title: 'Select all users',
      description: 'Write a query to select all users',
      score: 20,
    });

    exerciseRepository.findById.mockResolvedValue(exercise);

    const result = await useCase.getExerciseById('ex-1');

    expect(result).toMatchObject({
      id: 'ex-1',
      title: 'Select all users',
      description: 'Write a query to select all users',
      enunciado: 'Write a query to select all users',
      score: 20,
      level: { id: 1, name: 'Básico' },
      category: { id: 1, name: 'SELECT' },
    });
    // expected_solution must NOT be exposed
    expect(result).not.toHaveProperty('expected_solution');
  });

  it('10. exercise not found — findById returns null → throws EXERCISE_NOT_FOUND (Req 4.5)', async () => {
    const { useCase, exerciseRepository } = makeMocks();

    exerciseRepository.findById.mockResolvedValue(null);

    await expect(useCase.getExerciseById('non-existent-id')).rejects.toMatchObject({
      code: 'EXERCISE_NOT_FOUND',
    });
  });

  it('11. exercise not found — error message is a string (Req 4.5)', async () => {
    const { useCase, exerciseRepository } = makeMocks();

    exerciseRepository.findById.mockResolvedValue(null);

    await expect(useCase.getExerciseById('ghost-id')).rejects.toMatchObject({
      code: 'EXERCISE_NOT_FOUND',
      message: expect.any(String),
    });
  });

  it('12. findById is called with the provided exerciseId', async () => {
    const { useCase, exerciseRepository } = makeMocks();

    exerciseRepository.findById.mockResolvedValue(null);

    await useCase.getExerciseById('my-exercise-id').catch(() => {
      // expected to throw
    });

    expect(exerciseRepository.findById).toHaveBeenCalledWith('my-exercise-id');
  });
});

// ---------------------------------------------------------------------------
// Property-Based Tests
// ---------------------------------------------------------------------------

import * as fc from 'fast-check';

describe('ExerciseUseCase — Property-Based Tests', () => {
  // Feature: query-arena, Property 9
  // Validates: Requirements 4.1
  it('Property 9: Catálogo devuelve solo ejercicios activos con campos completos', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            isActive: fc.boolean(),
            levelId: fc.integer({ min: 1, max: 5 }),
            categoryId: fc.integer({ min: 1, max: 5 }),
          }),
          { minLength: 0, maxLength: 20 },
        ),
        async (exerciseSpecs) => {
          const { useCase, exerciseRepository } = makeMocks();

          const exercises: ReturnType<typeof makeExercise>[] = exerciseSpecs.map((spec, i) =>
            makeExercise({
              id: `ex-${i}`,
              is_active: spec.isActive,
              level_id: spec.levelId,
              category_id: spec.categoryId,
              level: makeLevel({ id: spec.levelId, name: `Level ${spec.levelId}` }),
              category: makeCategory({ id: spec.categoryId, name: `Category ${spec.categoryId}` }),
            }),
          );

          exerciseRepository.findAll.mockResolvedValue(exercises);

          const result = await useCase.listExercises();

          // Only active exercises are returned
          const activeCount = exercises.filter((e) => e.is_active).length;
          expect(result).toHaveLength(activeCount);

          // Every returned item has all required fields
          for (const item of result) {
            expect(typeof item.id).toBe('string');
            expect(typeof item.title).toBe('string');
            expect(typeof item.description).toBe('string');
            expect(item.level).toBeDefined();
            expect(typeof item.level.id).toBe('number');
            expect(typeof item.level.name).toBe('string');
            expect(item.category).toBeDefined();
            expect(typeof item.category.id).toBe('number');
            expect(typeof item.category.name).toBe('string');
          }

          // No inactive exercise sneaks in
          const activeIds = new Set(exercises.filter((e) => e.is_active).map((e) => e.id));
          for (const item of result) {
            expect(activeIds.has(item.id)).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: query-arena, Property 10
  // Validates: Requirements 4.2, 4.3
  it('Property 10: Filtrado por nivel o categoría es exhaustivo y exclusivo', async () => {
    await fc.assert(
      fc.asyncProperty(
        // The filter value we will apply (level_id or category_id, 1–5)
        fc.integer({ min: 1, max: 5 }),
        // Whether to filter by level (true) or category (false)
        fc.boolean(),
        // A controlled set of exercises: some match the filter, some may be inactive
        fc.array(
          fc.record({
            matchesFilter: fc.boolean(),
            isActive: fc.boolean(),
            otherId: fc.integer({ min: 1, max: 5 }),
          }),
          { minLength: 0, maxLength: 20 },
        ),
        async (filterId, filterByLevel, exerciseSpecs) => {
          const { useCase, exerciseRepository } = makeMocks();

          // Build a repository that only returns exercises matching the filter
          // (simulating that the DB/adapter already pre-filters by level/category)
          const matchingExercises = exerciseSpecs
            .filter((spec) => spec.matchesFilter)
            .map((spec, i) => {
              const levelId = filterByLevel ? filterId : spec.otherId;
              const categoryId = filterByLevel ? spec.otherId : filterId;
              return makeExercise({
                id: `ex-match-${i}`,
                is_active: spec.isActive,
                level_id: levelId,
                category_id: categoryId,
                level: makeLevel({ id: levelId, name: `Level ${levelId}` }),
                category: makeCategory({ id: categoryId, name: `Category ${categoryId}` }),
              });
            });

          exerciseRepository.findAll.mockResolvedValue(matchingExercises);

          const filters = filterByLevel
            ? { level_id: filterId }
            : { category_id: filterId };

          const result = await useCase.listExercises(filters);

          // The use case must call findAll with exactly the given filter
          if (filterByLevel) {
            expect(exerciseRepository.findAll).toHaveBeenCalledWith({
              level_id: filterId,
              category_id: undefined,
            });
          } else {
            expect(exerciseRepository.findAll).toHaveBeenCalledWith({
              level_id: undefined,
              category_id: filterId,
            });
          }

          // Exhaustiveness: all active matching exercises are included
          const activeMatchingIds = new Set(
            matchingExercises.filter((e) => e.is_active).map((e) => e.id),
          );
          expect(result).toHaveLength(activeMatchingIds.size);

          // Exclusivity: every returned exercise belongs to the correct level/category
          for (const item of result) {
            if (filterByLevel) {
              expect(item.level.id).toBe(filterId);
            } else {
              expect(item.category.id).toBe(filterId);
            }
          }

          // No inactive exercise sneaks in
          const resultIds = result.map((e) => e.id);
          for (const id of resultIds) {
            expect(activeMatchingIds.has(id)).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
