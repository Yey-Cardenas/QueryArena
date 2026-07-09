/**
 * Additional unit tests for AdminUseCase — covering lines not reached by the
 * existing spec: updateLevel, updateCategory, listLevels, listCategories,
 * listExercisesAdmin, updateExercise, and the remaining createExercise
 * validation branches (description, enunciado, level_id, category_id missing).
 */

import { AdminUseCase } from '../../src/domain/use-cases/AdminUseCase';
import type { ILevelRepository }    from '../../src/domain/ports/out/ILevelRepository';
import type { ICategoryRepository } from '../../src/domain/ports/out/ICategoryRepository';
import type { IExerciseRepository } from '../../src/domain/ports/out/IExerciseRepository';
import type { IAttemptRepository }  from '../../src/domain/ports/out/IAttemptRepository';
import type { Level, Category, Exercise } from '../../src/domain/entities/Exercise';
import type { CreateExerciseDto }   from '../../src/domain/ports/in/IAdminUseCase';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const now = new Date('2024-01-01T00:00:00Z');

function makeLevel(o: Partial<Level> = {}): Level {
  return { id: 1, name: 'Básico', created_at: now, ...o };
}
function makeCategory(o: Partial<Category> = {}): Category {
  return { id: 1, name: 'SELECT', created_at: now, ...o };
}
function makeExercise(o: Partial<Exercise> = {}): Exercise {
  return {
    id: 'ex-1', title: 'T', description: 'D', expected_solution: 'SELECT 1',
    score: 10, is_active: true, level_id: 1, category_id: 1,
    created_at: now, updated_at: now, ...o,
  };
}
function makeDto(o: Partial<CreateExerciseDto> = {}): CreateExerciseDto {
  return {
    title: 'Title', description: 'Desc', enunciado: 'Full statement',
    expected_solution: 'SELECT 1', score: 10, level_id: 1, category_id: 1,
    ...o,
  };
}

// ── Mock factory ──────────────────────────────────────────────────────────────

function makeMocks() {
  const levelRepository: jest.Mocked<ILevelRepository> = {
    findAll: jest.fn(), findById: jest.fn(), findByName: jest.fn(),
    create: jest.fn(), update: jest.fn(), delete: jest.fn(),
  };
  const categoryRepository: jest.Mocked<ICategoryRepository> = {
    findAll: jest.fn(), findById: jest.fn(), findByName: jest.fn(),
    create: jest.fn(), update: jest.fn(), delete: jest.fn(),
  };
  const exerciseRepository: jest.Mocked<IExerciseRepository> = {
    findAll: jest.fn(), findById: jest.fn(), create: jest.fn(),
    update: jest.fn(), delete: jest.fn(),
    countByLevel: jest.fn(), countByCategory: jest.fn(),
  };
  const attemptRepository: jest.Mocked<IAttemptRepository> = {
    create: jest.fn(), findByUser: jest.fn(),
    update: jest.fn(), countByExercise: jest.fn(),
  };
  const useCase = new AdminUseCase(
    levelRepository, categoryRepository, exerciseRepository, attemptRepository,
  );
  return { useCase, levelRepository, categoryRepository, exerciseRepository, attemptRepository };
}

// =============================================================================
// updateLevel()
// =============================================================================

describe('AdminUseCase.updateLevel()', () => {
  it('success — level exists, new name is unique → updates and returns Level', async () => {
    const { useCase, levelRepository } = makeMocks();
    const updated = makeLevel({ name: 'Avanzado' });

    levelRepository.findById.mockResolvedValue(makeLevel());
    levelRepository.findByName.mockResolvedValue(null);
    levelRepository.update.mockResolvedValue(updated);

    const result = await useCase.updateLevel(1, 'Avanzado');

    expect(result).toEqual(updated);
    expect(levelRepository.update).toHaveBeenCalledWith(1, 'Avanzado');
  });

  it('success — keeping the same name (no conflict with itself)', async () => {
    const { useCase, levelRepository } = makeMocks();
    const level = makeLevel({ id: 1, name: 'Básico' });

    levelRepository.findById.mockResolvedValue(level);
    // findByName returns the SAME level (same id) → not a conflict
    levelRepository.findByName.mockResolvedValue(level);
    levelRepository.update.mockResolvedValue(level);

    const result = await useCase.updateLevel(1, 'Básico');
    expect(result.name).toBe('Básico');
  });

  it('empty name → throws VALIDATION_ERROR', async () => {
    const { useCase } = makeMocks();
    await expect(useCase.updateLevel(1, '')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR', field: 'name',
    });
  });

  it('whitespace name → throws VALIDATION_ERROR', async () => {
    const { useCase } = makeMocks();
    await expect(useCase.updateLevel(1, '   ')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR', field: 'name',
    });
  });

  it('level not found → throws NOT_FOUND', async () => {
    const { useCase, levelRepository } = makeMocks();
    levelRepository.findById.mockResolvedValue(null);

    await expect(useCase.updateLevel(999, 'X')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(levelRepository.update).not.toHaveBeenCalled();
  });

  it('name conflicts with ANOTHER level → throws NAME_ALREADY_EXISTS', async () => {
    const { useCase, levelRepository } = makeMocks();

    levelRepository.findById.mockResolvedValue(makeLevel({ id: 1 }));
    // findByName returns a DIFFERENT level (id=2)
    levelRepository.findByName.mockResolvedValue(makeLevel({ id: 2, name: 'Intermedio' }));

    await expect(useCase.updateLevel(1, 'Intermedio')).rejects.toMatchObject({
      code: 'NAME_ALREADY_EXISTS', field: 'name',
    });
    expect(levelRepository.update).not.toHaveBeenCalled();
  });
});

// =============================================================================
// listLevels()
// =============================================================================

describe('AdminUseCase.listLevels()', () => {
  it('returns all levels from repository', async () => {
    const { useCase, levelRepository } = makeMocks();
    const levels = [makeLevel({ id: 1 }), makeLevel({ id: 2, name: 'Intermedio' })];
    levelRepository.findAll.mockResolvedValue(levels);

    const result = await useCase.listLevels();
    expect(result).toEqual(levels);
    expect(levelRepository.findAll).toHaveBeenCalledTimes(1);
  });

  it('returns empty array when no levels exist', async () => {
    const { useCase, levelRepository } = makeMocks();
    levelRepository.findAll.mockResolvedValue([]);
    const result = await useCase.listLevels();
    expect(result).toEqual([]);
  });
});

// =============================================================================
// updateCategory()
// =============================================================================

describe('AdminUseCase.updateCategory()', () => {
  it('success — category exists, new name is unique → updates and returns Category', async () => {
    const { useCase, categoryRepository } = makeMocks();
    const updated = makeCategory({ name: 'JOIN' });

    categoryRepository.findById.mockResolvedValue(makeCategory());
    categoryRepository.findByName.mockResolvedValue(null);
    categoryRepository.update.mockResolvedValue(updated);

    const result = await useCase.updateCategory(1, 'JOIN');
    expect(result).toEqual(updated);
    expect(categoryRepository.update).toHaveBeenCalledWith(1, 'JOIN');
  });

  it('success — keeping the same name (no conflict with itself)', async () => {
    const { useCase, categoryRepository } = makeMocks();
    const cat = makeCategory({ id: 1, name: 'SELECT' });

    categoryRepository.findById.mockResolvedValue(cat);
    categoryRepository.findByName.mockResolvedValue(cat); // same id → no conflict
    categoryRepository.update.mockResolvedValue(cat);

    const result = await useCase.updateCategory(1, 'SELECT');
    expect(result.name).toBe('SELECT');
  });

  it('empty name → throws VALIDATION_ERROR', async () => {
    const { useCase } = makeMocks();
    await expect(useCase.updateCategory(1, '')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR', field: 'name',
    });
  });

  it('whitespace name → throws VALIDATION_ERROR', async () => {
    const { useCase } = makeMocks();
    await expect(useCase.updateCategory(1, '   ')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR', field: 'name',
    });
  });

  it('category not found → throws NOT_FOUND', async () => {
    const { useCase, categoryRepository } = makeMocks();
    categoryRepository.findById.mockResolvedValue(null);

    await expect(useCase.updateCategory(999, 'X')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(categoryRepository.update).not.toHaveBeenCalled();
  });

  it('name conflicts with ANOTHER category → throws NAME_ALREADY_EXISTS', async () => {
    const { useCase, categoryRepository } = makeMocks();

    categoryRepository.findById.mockResolvedValue(makeCategory({ id: 1 }));
    categoryRepository.findByName.mockResolvedValue(makeCategory({ id: 2, name: 'JOIN' }));

    await expect(useCase.updateCategory(1, 'JOIN')).rejects.toMatchObject({
      code: 'NAME_ALREADY_EXISTS', field: 'name',
    });
    expect(categoryRepository.update).not.toHaveBeenCalled();
  });
});

// =============================================================================
// listCategories()
// =============================================================================

describe('AdminUseCase.listCategories()', () => {
  it('returns all categories from repository', async () => {
    const { useCase, categoryRepository } = makeMocks();
    const cats = [makeCategory({ id: 1 }), makeCategory({ id: 2, name: 'JOIN' })];
    categoryRepository.findAll.mockResolvedValue(cats);

    const result = await useCase.listCategories();
    expect(result).toEqual(cats);
    expect(categoryRepository.findAll).toHaveBeenCalledTimes(1);
  });

  it('returns empty array when no categories exist', async () => {
    const { useCase, categoryRepository } = makeMocks();
    categoryRepository.findAll.mockResolvedValue([]);
    const result = await useCase.listCategories();
    expect(result).toEqual([]);
  });
});

// =============================================================================
// createExercise() — missing validation branches
// =============================================================================

describe('AdminUseCase.createExercise() — additional validation', () => {
  it('empty description → throws VALIDATION_ERROR for "description"', async () => {
    const { useCase } = makeMocks();
    await expect(useCase.createExercise(makeDto({ description: '' }))).rejects.toMatchObject({
      code: 'VALIDATION_ERROR', field: 'description',
    });
  });

  it('empty enunciado → throws VALIDATION_ERROR for "enunciado"', async () => {
    const { useCase } = makeMocks();
    await expect(useCase.createExercise(makeDto({ enunciado: '' }))).rejects.toMatchObject({
      code: 'VALIDATION_ERROR', field: 'enunciado',
    });
  });

  it('undefined description → throws VALIDATION_ERROR for "description"', async () => {
    const { useCase } = makeMocks();
    const dto = makeDto();
    // @ts-expect-error testing undefined path
    dto.description = undefined;
    await expect(useCase.createExercise(dto)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR', field: 'description',
    });
  });

  it('undefined enunciado → throws VALIDATION_ERROR for "enunciado"', async () => {
    const { useCase } = makeMocks();
    const dto = makeDto();
    // @ts-expect-error testing undefined path
    dto.enunciado = undefined;
    await expect(useCase.createExercise(dto)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR', field: 'enunciado',
    });
  });

  it('undefined level_id → throws VALIDATION_ERROR for "level_id"', async () => {
    const { useCase } = makeMocks();
    const dto = makeDto();
    // @ts-expect-error testing undefined path
    dto.level_id = undefined;
    await expect(useCase.createExercise(dto)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR', field: 'level_id',
    });
  });

  it('undefined category_id → throws VALIDATION_ERROR for "category_id"', async () => {
    const { useCase, levelRepository } = makeMocks();
    levelRepository.findById.mockResolvedValue(makeLevel());
    const dto = makeDto();
    // @ts-expect-error testing undefined path
    dto.category_id = undefined;
    await expect(useCase.createExercise(dto)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR', field: 'category_id',
    });
  });

  it('uses default score of 10 when score is not provided', async () => {
    const { useCase, levelRepository, categoryRepository, exerciseRepository } = makeMocks();
    levelRepository.findById.mockResolvedValue(makeLevel());
    categoryRepository.findById.mockResolvedValue(makeCategory());
    exerciseRepository.create.mockResolvedValue(makeExercise({ score: 10 }));

    const dto = makeDto();
    // @ts-expect-error testing undefined path
    dto.score = undefined;
    await useCase.createExercise(dto);

    expect(exerciseRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ score: 10 }),
    );
  });
});

// =============================================================================
// updateExercise()
// =============================================================================

describe('AdminUseCase.updateExercise()', () => {
  it('success — exercise exists, valid partial data → updates and returns Exercise', async () => {
    const { useCase, exerciseRepository } = makeMocks();
    const updated = makeExercise({ title: 'New Title' });

    exerciseRepository.findById.mockResolvedValue(makeExercise());
    exerciseRepository.update.mockResolvedValue(updated);

    const result = await useCase.updateExercise('ex-1', { title: 'New Title' });
    expect(result.title).toBe('New Title');
    expect(exerciseRepository.update).toHaveBeenCalledTimes(1);
  });

  it('exercise not found → throws NOT_FOUND', async () => {
    const { useCase, exerciseRepository } = makeMocks();
    exerciseRepository.findById.mockResolvedValue(null);

    await expect(useCase.updateExercise('nonexistent', { title: 'X' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(exerciseRepository.update).not.toHaveBeenCalled();
  });

  it('empty title supplied → throws VALIDATION_ERROR for "title"', async () => {
    const { useCase, exerciseRepository } = makeMocks();
    exerciseRepository.findById.mockResolvedValue(makeExercise());

    await expect(useCase.updateExercise('ex-1', { title: '' })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR', field: 'title',
    });
  });

  it('empty enunciado supplied → throws VALIDATION_ERROR for "enunciado"', async () => {
    const { useCase, exerciseRepository } = makeMocks();
    exerciseRepository.findById.mockResolvedValue(makeExercise());

    await expect(useCase.updateExercise('ex-1', { enunciado: '' })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR', field: 'enunciado',
    });
  });

  it('empty expected_solution supplied → throws VALIDATION_ERROR for "expected_solution"', async () => {
    const { useCase, exerciseRepository } = makeMocks();
    exerciseRepository.findById.mockResolvedValue(makeExercise());

    await expect(useCase.updateExercise('ex-1', { expected_solution: '' })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR', field: 'expected_solution',
    });
  });

  it('non-existent level_id supplied → throws INVALID_REFERENCE', async () => {
    const { useCase, exerciseRepository, levelRepository } = makeMocks();
    exerciseRepository.findById.mockResolvedValue(makeExercise());
    levelRepository.findById.mockResolvedValue(null);

    await expect(useCase.updateExercise('ex-1', { level_id: 999 })).rejects.toMatchObject({
      code: 'INVALID_REFERENCE', field: 'level_id',
    });
  });

  it('non-existent category_id supplied → throws INVALID_REFERENCE', async () => {
    const { useCase, exerciseRepository, levelRepository, categoryRepository } = makeMocks();
    exerciseRepository.findById.mockResolvedValue(makeExercise());
    levelRepository.findById.mockResolvedValue(makeLevel());
    categoryRepository.findById.mockResolvedValue(null);

    await expect(useCase.updateExercise('ex-1', { level_id: 1, category_id: 888 })).rejects.toMatchObject({
      code: 'INVALID_REFERENCE', field: 'category_id',
    });
  });

  it('updates description via enunciado field', async () => {
    const { useCase, exerciseRepository } = makeMocks();
    const updated = makeExercise({ description: 'New statement' });

    exerciseRepository.findById.mockResolvedValue(makeExercise());
    exerciseRepository.update.mockResolvedValue(updated);

    await useCase.updateExercise('ex-1', { enunciado: 'New statement' });

    expect(exerciseRepository.update).toHaveBeenCalledWith(
      'ex-1',
      expect.objectContaining({ description: 'New statement' }),
    );
  });

  it('updates description via description field when enunciado is absent', async () => {
    const { useCase, exerciseRepository } = makeMocks();
    const updated = makeExercise({ description: 'Plain desc' });

    exerciseRepository.findById.mockResolvedValue(makeExercise());
    exerciseRepository.update.mockResolvedValue(updated);

    await useCase.updateExercise('ex-1', { description: 'Plain desc' });

    expect(exerciseRepository.update).toHaveBeenCalledWith(
      'ex-1',
      expect.objectContaining({ description: 'Plain desc' }),
    );
  });

  it('updates score and level_id when valid', async () => {
    const { useCase, exerciseRepository, levelRepository } = makeMocks();
    const updated = makeExercise({ score: 25, level_id: 2 });

    exerciseRepository.findById.mockResolvedValue(makeExercise());
    levelRepository.findById.mockResolvedValue(makeLevel({ id: 2 }));
    exerciseRepository.update.mockResolvedValue(updated);

    const result = await useCase.updateExercise('ex-1', { score: 25, level_id: 2 });
    expect(result.score).toBe(25);
    expect(result.level_id).toBe(2);
  });

  it('updates category_id when valid', async () => {
    const { useCase, exerciseRepository, categoryRepository } = makeMocks();
    const updated = makeExercise({ category_id: 3 });

    exerciseRepository.findById.mockResolvedValue(makeExercise());
    categoryRepository.findById.mockResolvedValue(makeCategory({ id: 3 }));
    exerciseRepository.update.mockResolvedValue(updated);

    const result = await useCase.updateExercise('ex-1', { category_id: 3 });
    expect(result.category_id).toBe(3);
  });
});

// =============================================================================
// listExercisesAdmin()
// =============================================================================

describe('AdminUseCase.listExercisesAdmin()', () => {
  it('returns all exercises including inactive ones', async () => {
    const { useCase, exerciseRepository } = makeMocks();
    const exercises = [
      makeExercise({ id: 'ex-1', is_active: true }),
      makeExercise({ id: 'ex-2', is_active: false }),
    ];
    exerciseRepository.findAll.mockResolvedValue(exercises);

    const result = await useCase.listExercisesAdmin();

    expect(result).toHaveLength(2);
    expect(exerciseRepository.findAll).toHaveBeenCalledWith(); // no filters
  });

  it('returns empty array when no exercises', async () => {
    const { useCase, exerciseRepository } = makeMocks();
    exerciseRepository.findAll.mockResolvedValue([]);

    const result = await useCase.listExercisesAdmin();
    expect(result).toEqual([]);
  });
});

// =============================================================================
// deleteCategory() — NOT_FOUND branch
// =============================================================================

describe('AdminUseCase.deleteCategory() — not found', () => {
  it('category not found → throws NOT_FOUND, delete not called', async () => {
    const { useCase, categoryRepository } = makeMocks();
    categoryRepository.findById.mockResolvedValue(null);

    await expect(useCase.deleteCategory(999)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(categoryRepository.delete).not.toHaveBeenCalled();
  });
});
