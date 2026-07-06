/**
 * Unit tests for AdminUseCase
 *
 * All four output ports are mocked with jest.fn() — no real database.
 * Covers:
 *   - Successful creation of level, category, and exercise (Req 11.1, 12.1, 13.1)
 *   - Deletion of level WITH exercises → rejected (Req 11.4)
 *   - Deletion of level WITHOUT exercises → success (Req 11.3)
 *   - Deletion of exercise WITH attempts → rejected (Req 13.4)
 *   - Creation of exercise with non-existent level_id → rejected (Req 13.5)
 *   - Creation of exercise with non-existent category_id → rejected (Req 13.6)
 */

import { AdminUseCase } from '../../src/domain/use-cases/AdminUseCase';
import type { ILevelRepository } from '../../src/domain/ports/out/ILevelRepository';
import type { ICategoryRepository } from '../../src/domain/ports/out/ICategoryRepository';
import type { IExerciseRepository } from '../../src/domain/ports/out/IExerciseRepository';
import type { IAttemptRepository } from '../../src/domain/ports/out/IAttemptRepository';
import type { Level, Category, Exercise } from '../../src/domain/entities/Exercise';
import type { CreateExerciseDto } from '../../src/domain/ports/in/IAdminUseCase';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeLevel(overrides: Partial<Level> = {}): Level {
  return {
    id: 1,
    name: 'Básico',
    created_at: new Date(),
    ...overrides,
  };
}

function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 1,
    name: 'SELECT',
    created_at: new Date(),
    ...overrides,
  };
}

function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'ex-uuid-1',
    title: 'Select all users',
    description: 'Write a query to select all users from the users table.',
    expected_solution: 'SELECT * FROM users',
    score: 10,
    is_active: true,
    level_id: 1,
    category_id: 1,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function makeCreateExerciseDto(overrides: Partial<CreateExerciseDto> = {}): CreateExerciseDto {
  return {
    title: 'Select all users',
    description: 'Short description',
    enunciado: 'Write a query to select all users from the users table.',
    expected_solution: 'SELECT * FROM users',
    score: 10,
    level_id: 1,
    category_id: 1,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------

function makeMocks() {
  const levelRepository: jest.Mocked<ILevelRepository> = {
    findAll: jest.fn(),
    findById: jest.fn(),
    findByName: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const categoryRepository: jest.Mocked<ICategoryRepository> = {
    findAll: jest.fn(),
    findById: jest.fn(),
    findByName: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const exerciseRepository: jest.Mocked<IExerciseRepository> = {
    findAll: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    countByLevel: jest.fn(),
    countByCategory: jest.fn(),
  };

  const attemptRepository: jest.Mocked<IAttemptRepository> = {
    create: jest.fn(),
    findByUser: jest.fn(),
    update: jest.fn(),
    countByExercise: jest.fn(),
  };

  const useCase = new AdminUseCase(
    levelRepository,
    categoryRepository,
    exerciseRepository,
    attemptRepository,
  );

  return { useCase, levelRepository, categoryRepository, exerciseRepository, attemptRepository };
}

// ===========================================================================
// createLevel()
// ===========================================================================

describe('AdminUseCase.createLevel()', () => {
  // Req 11.1
  it('1. success — unique name → persists and returns Level with assigned id', async () => {
    const { useCase, levelRepository } = makeMocks();
    const created = makeLevel({ id: 7, name: 'Avanzado' });

    levelRepository.findByName.mockResolvedValue(null);
    levelRepository.create.mockResolvedValue(created);

    const result = await useCase.createLevel('Avanzado');

    expect(result).toEqual(created);
    expect(levelRepository.findByName).toHaveBeenCalledWith('Avanzado');
    expect(levelRepository.create).toHaveBeenCalledWith('Avanzado');
  });

  // Req 11.5
  it('2. duplicate name → throws NAME_ALREADY_EXISTS, create not called', async () => {
    const { useCase, levelRepository } = makeMocks();

    levelRepository.findByName.mockResolvedValue(makeLevel({ name: 'Básico' }));

    await expect(useCase.createLevel('Básico')).rejects.toMatchObject({
      code: 'NAME_ALREADY_EXISTS',
      field: 'name',
    });

    expect(levelRepository.create).not.toHaveBeenCalled();
  });

  it('3. empty name → throws VALIDATION_ERROR', async () => {
    const { useCase } = makeMocks();

    await expect(useCase.createLevel('')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      field: 'name',
    });
  });

  it('4. whitespace-only name → throws VALIDATION_ERROR', async () => {
    const { useCase } = makeMocks();

    await expect(useCase.createLevel('   ')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      field: 'name',
    });
  });
});

// ===========================================================================
// deleteLevel()
// ===========================================================================

describe('AdminUseCase.deleteLevel()', () => {
  // Req 11.4 — level HAS exercises → rejected atomically
  it('5. level with exercises → throws HAS_ASSOCIATED_EXERCISES, delete not called', async () => {
    const { useCase, levelRepository, exerciseRepository } = makeMocks();
    const level = makeLevel({ id: 2, name: 'Intermedio' });

    levelRepository.findById.mockResolvedValue(level);
    exerciseRepository.countByLevel.mockResolvedValue(3); // 3 exercises associated

    await expect(useCase.deleteLevel(2)).rejects.toMatchObject({
      code: 'HAS_ASSOCIATED_EXERCISES',
    });

    expect(exerciseRepository.countByLevel).toHaveBeenCalledWith(2);
    expect(levelRepository.delete).not.toHaveBeenCalled();
  });

  // Req 11.3 — level has NO exercises → success
  it('6. level with no exercises → deletes successfully', async () => {
    const { useCase, levelRepository, exerciseRepository } = makeMocks();
    const level = makeLevel({ id: 3, name: 'Avanzado' });

    levelRepository.findById.mockResolvedValue(level);
    exerciseRepository.countByLevel.mockResolvedValue(0); // no exercises
    levelRepository.delete.mockResolvedValue(undefined);

    await expect(useCase.deleteLevel(3)).resolves.toBeUndefined();

    expect(levelRepository.delete).toHaveBeenCalledWith(3);
  });

  it('7. level not found → throws NOT_FOUND, delete not called', async () => {
    const { useCase, levelRepository } = makeMocks();

    levelRepository.findById.mockResolvedValue(null);

    await expect(useCase.deleteLevel(999)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });

    expect(levelRepository.delete).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// createCategory()
// ===========================================================================

describe('AdminUseCase.createCategory()', () => {
  // Req 12.1
  it('8. success — unique name → persists and returns Category with assigned id', async () => {
    const { useCase, categoryRepository } = makeMocks();
    const created = makeCategory({ id: 5, name: 'JOIN' });

    categoryRepository.findByName.mockResolvedValue(null);
    categoryRepository.create.mockResolvedValue(created);

    const result = await useCase.createCategory('JOIN');

    expect(result).toEqual(created);
    expect(categoryRepository.findByName).toHaveBeenCalledWith('JOIN');
    expect(categoryRepository.create).toHaveBeenCalledWith('JOIN');
  });

  // Req 12.5
  it('9. duplicate name → throws NAME_ALREADY_EXISTS, create not called', async () => {
    const { useCase, categoryRepository } = makeMocks();

    categoryRepository.findByName.mockResolvedValue(makeCategory({ name: 'SELECT' }));

    await expect(useCase.createCategory('SELECT')).rejects.toMatchObject({
      code: 'NAME_ALREADY_EXISTS',
      field: 'name',
    });

    expect(categoryRepository.create).not.toHaveBeenCalled();
  });

  it('10. empty name → throws VALIDATION_ERROR', async () => {
    const { useCase } = makeMocks();

    await expect(useCase.createCategory('')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      field: 'name',
    });
  });
});

// ===========================================================================
// deleteCategory()
// ===========================================================================

describe('AdminUseCase.deleteCategory()', () => {
  // Req 12.4 — category HAS exercises → rejected atomically
  it('11. category with exercises → throws HAS_ASSOCIATED_EXERCISES, delete not called', async () => {
    const { useCase, categoryRepository, exerciseRepository } = makeMocks();
    const category = makeCategory({ id: 2, name: 'JOIN' });

    categoryRepository.findById.mockResolvedValue(category);
    exerciseRepository.countByCategory.mockResolvedValue(5);

    await expect(useCase.deleteCategory(2)).rejects.toMatchObject({
      code: 'HAS_ASSOCIATED_EXERCISES',
    });

    expect(exerciseRepository.countByCategory).toHaveBeenCalledWith(2);
    expect(categoryRepository.delete).not.toHaveBeenCalled();
  });

  // Req 12.3 — category has NO exercises → success
  it('12. category with no exercises → deletes successfully', async () => {
    const { useCase, categoryRepository, exerciseRepository } = makeMocks();
    const category = makeCategory({ id: 3, name: 'Subqueries' });

    categoryRepository.findById.mockResolvedValue(category);
    exerciseRepository.countByCategory.mockResolvedValue(0);
    categoryRepository.delete.mockResolvedValue(undefined);

    await expect(useCase.deleteCategory(3)).resolves.toBeUndefined();

    expect(categoryRepository.delete).toHaveBeenCalledWith(3);
  });
});

// ===========================================================================
// createExercise()
// ===========================================================================

describe('AdminUseCase.createExercise()', () => {
  // Req 13.1 — successful creation
  it('13. success — valid dto, level and category exist → persists and returns Exercise', async () => {
    const { useCase, levelRepository, categoryRepository, exerciseRepository } = makeMocks();
    const dto = makeCreateExerciseDto();
    const created = makeExercise();

    levelRepository.findById.mockResolvedValue(makeLevel({ id: 1 }));
    categoryRepository.findById.mockResolvedValue(makeCategory({ id: 1 }));
    exerciseRepository.create.mockResolvedValue(created);

    const result = await useCase.createExercise(dto);

    expect(result).toEqual(created);
    expect(levelRepository.findById).toHaveBeenCalledWith(1);
    expect(categoryRepository.findById).toHaveBeenCalledWith(1);
    expect(exerciseRepository.create).toHaveBeenCalledTimes(1);
  });

  // Req 13.5 — non-existent level_id → rejected
  it('14. non-existent level_id → throws INVALID_REFERENCE with field "level_id", exercise not created', async () => {
    const { useCase, levelRepository, categoryRepository, exerciseRepository } = makeMocks();
    const dto = makeCreateExerciseDto({ level_id: 999 });

    levelRepository.findById.mockResolvedValue(null); // level 999 does not exist
    categoryRepository.findById.mockResolvedValue(makeCategory({ id: 1 }));

    await expect(useCase.createExercise(dto)).rejects.toMatchObject({
      code: 'INVALID_REFERENCE',
      field: 'level_id',
    });

    expect(exerciseRepository.create).not.toHaveBeenCalled();
  });

  // Req 13.6 — non-existent category_id → rejected
  it('15. non-existent category_id → throws INVALID_REFERENCE with field "category_id", exercise not created', async () => {
    const { useCase, levelRepository, categoryRepository, exerciseRepository } = makeMocks();
    const dto = makeCreateExerciseDto({ category_id: 888 });

    levelRepository.findById.mockResolvedValue(makeLevel({ id: 1 }));
    categoryRepository.findById.mockResolvedValue(null); // category 888 does not exist

    await expect(useCase.createExercise(dto)).rejects.toMatchObject({
      code: 'INVALID_REFERENCE',
      field: 'category_id',
    });

    expect(exerciseRepository.create).not.toHaveBeenCalled();
  });

  // Req 13.7 — missing required fields
  it('16. empty title → throws VALIDATION_ERROR with field "title"', async () => {
    const { useCase } = makeMocks();
    const dto = makeCreateExerciseDto({ title: '' });

    await expect(useCase.createExercise(dto)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      field: 'title',
    });
  });

  it('17. empty expected_solution → throws VALIDATION_ERROR with field "expected_solution"', async () => {
    const { useCase } = makeMocks();
    const dto = makeCreateExerciseDto({ expected_solution: '' });

    await expect(useCase.createExercise(dto)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      field: 'expected_solution',
    });
  });
});

// ===========================================================================
// deleteExercise()
// ===========================================================================

describe('AdminUseCase.deleteExercise()', () => {
  // Req 13.4 — exercise HAS attempts → rejected
  it('18. exercise with attempts → throws HAS_ASSOCIATED_ATTEMPTS, delete not called', async () => {
    const { useCase, exerciseRepository, attemptRepository } = makeMocks();
    const exercise = makeExercise({ id: 'ex-1' });

    exerciseRepository.findById.mockResolvedValue(exercise);
    attemptRepository.countByExercise.mockResolvedValue(2);

    await expect(useCase.deleteExercise('ex-1')).rejects.toMatchObject({
      code: 'HAS_ASSOCIATED_ATTEMPTS',
    });

    expect(attemptRepository.countByExercise).toHaveBeenCalledWith('ex-1');
    expect(exerciseRepository.delete).not.toHaveBeenCalled();
  });

  // Req 13.3 — exercise has NO attempts → success
  it('19. exercise with no attempts → deletes successfully', async () => {
    const { useCase, exerciseRepository, attemptRepository } = makeMocks();
    const exercise = makeExercise({ id: 'ex-2' });

    exerciseRepository.findById.mockResolvedValue(exercise);
    attemptRepository.countByExercise.mockResolvedValue(0);
    exerciseRepository.delete.mockResolvedValue(undefined);

    await expect(useCase.deleteExercise('ex-2')).resolves.toBeUndefined();

    expect(exerciseRepository.delete).toHaveBeenCalledWith('ex-2');
  });

  it('20. exercise not found → throws NOT_FOUND, delete not called', async () => {
    const { useCase, exerciseRepository } = makeMocks();

    exerciseRepository.findById.mockResolvedValue(null);

    await expect(useCase.deleteExercise('nonexistent-id')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });

    expect(exerciseRepository.delete).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// Property-Based Test — Property 18
// Req 11.4, 12.4, 13.4
// ===========================================================================

import * as fc from 'fast-check';

describe('AdminUseCase — Property-Based Tests', () => {
  // Feature: query-arena, Property 18
  // Validates: Requirements 11.3, 11.4, 12.3, 12.4, 13.3, 13.4
  it('Property 18a: deleteLevel con ejercicios → siempre rechazado, delete nunca llamado', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 1000 }),    // level id
        fc.integer({ min: 1, max: 100 }),     // exercise count > 0
        async (levelId, exerciseCount) => {
          const { useCase, levelRepository, exerciseRepository } = makeMocks();

          levelRepository.findById.mockResolvedValue(makeLevel({ id: levelId }));
          exerciseRepository.countByLevel.mockResolvedValue(exerciseCount);

          await expect(useCase.deleteLevel(levelId)).rejects.toMatchObject({
            code: 'HAS_ASSOCIATED_EXERCISES',
          });

          expect(levelRepository.delete).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Property 18b: deleteCategory con ejercicios → siempre rechazado, delete nunca llamado', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 1000 }),  // category id
        fc.integer({ min: 1, max: 100 }),   // exercise count > 0
        async (categoryId, exerciseCount) => {
          const { useCase, categoryRepository, exerciseRepository } = makeMocks();

          categoryRepository.findById.mockResolvedValue(makeCategory({ id: categoryId }));
          exerciseRepository.countByCategory.mockResolvedValue(exerciseCount);

          await expect(useCase.deleteCategory(categoryId)).rejects.toMatchObject({
            code: 'HAS_ASSOCIATED_EXERCISES',
          });

          expect(categoryRepository.delete).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Property 18c: deleteExercise con intentos → siempre rechazado, delete nunca llamado', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),                         // exercise id
        fc.integer({ min: 1, max: 100 }),  // attempt count > 0
        async (exerciseId, attemptCount) => {
          const { useCase, exerciseRepository, attemptRepository } = makeMocks();

          exerciseRepository.findById.mockResolvedValue(makeExercise({ id: exerciseId }));
          attemptRepository.countByExercise.mockResolvedValue(attemptCount);

          await expect(useCase.deleteExercise(exerciseId)).rejects.toMatchObject({
            code: 'HAS_ASSOCIATED_ATTEMPTS',
          });

          expect(exerciseRepository.delete).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 100 },
    );
  });
});
