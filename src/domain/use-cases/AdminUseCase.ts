/**
 * AdminUseCase — application service for admin CRUD operations.
 *
 * Sections implemented progressively (tasks 8.1 → 8.2 → 8.3):
 *   8.1  Levels      ✓
 *   8.2  Categories  ✓
 *   8.3  Exercises   ✓
 *
 * Pure domain logic: no framework imports, no infrastructure dependencies.
 * All I/O is delegated to injected output ports.
 */

import type { IAdminUseCase, CreateExerciseDto } from '../ports/in/IAdminUseCase';
import type { ILevelRepository } from '../ports/out/ILevelRepository';
import type { ICategoryRepository } from '../ports/out/ICategoryRepository';
import type { IExerciseRepository } from '../ports/out/IExerciseRepository';
import type { IAttemptRepository } from '../ports/out/IAttemptRepository';
import type { Level, Category } from '../entities/Exercise';
import type { Exercise } from '../entities/Exercise';

// ---------------------------------------------------------------------------
// Domain error types
// ---------------------------------------------------------------------------

export interface DomainError {
  code:
    | 'NAME_ALREADY_EXISTS'
    | 'HAS_ASSOCIATED_EXERCISES'
    | 'HAS_ASSOCIATED_ATTEMPTS'
    | 'INVALID_REFERENCE'
    | 'VALIDATION_ERROR'
    | 'NOT_FOUND';
  message: string;
  field?: string;
}

/** Returns a typed DomainError — throw the result to reject the promise chain. */
function domainError(err: DomainError): DomainError {
  return err;
}

// ---------------------------------------------------------------------------
// AdminUseCase
// ---------------------------------------------------------------------------

export class AdminUseCase implements IAdminUseCase {
  constructor(
    private readonly levelRepository: ILevelRepository,
    private readonly categoryRepository: ICategoryRepository,
    private readonly exerciseRepository: IExerciseRepository,
    private readonly attemptRepository: IAttemptRepository,
  ) {}

  // =========================================================================
  // LEVELS (Task 8.1)
  // =========================================================================

  /**
   * Creates a new difficulty level.
   *
   * Requirements 11.1, 11.5:
   *   - Name must be non-empty.
   *   - Name must be unique across all levels.
   *   - Returns the persisted level with its assigned id.
   */
  async createLevel(name: string): Promise<Level> {
    // 1. Validate input
    if (!name || name.trim().length === 0) {
      throw domainError({
        code: 'VALIDATION_ERROR',
        message: 'Level name is required.',
        field: 'name',
      });
    }

    const trimmedName = name.trim();

    // 2. Check name uniqueness
    const existing = await this.levelRepository.findByName(trimmedName);
    if (existing !== null) {
      throw domainError({
        code: 'NAME_ALREADY_EXISTS',
        message: `A level named "${trimmedName}" already exists.`,
        field: 'name',
      });
    }

    // 3. Persist and return
    return this.levelRepository.create(trimmedName);
  }

  /**
   * Updates an existing level's name.
   *
   * Requirements 11.2, 11.5:
   *   - New name must be non-empty.
   *   - New name must not conflict with any other existing level.
   *   - Returns the updated level.
   */
  async updateLevel(id: number, name: string): Promise<Level> {
    // 1. Validate input
    if (!name || name.trim().length === 0) {
      throw domainError({
        code: 'VALIDATION_ERROR',
        message: 'Level name is required.',
        field: 'name',
      });
    }

    const trimmedName = name.trim();

    // 2. Ensure the level exists
    const level = await this.levelRepository.findById(id);
    if (level === null) {
      throw domainError({
        code: 'NOT_FOUND',
        message: `Level with id ${id} not found.`,
      });
    }

    // 3. Check name uniqueness against other levels (allow keeping the same name)
    const conflicting = await this.levelRepository.findByName(trimmedName);
    if (conflicting !== null && conflicting.id !== id) {
      throw domainError({
        code: 'NAME_ALREADY_EXISTS',
        message: `A level named "${trimmedName}" already exists.`,
        field: 'name',
      });
    }

    // 4. Persist and return
    return this.levelRepository.update(id, trimmedName);
  }

  /**
   * Deletes a level.
   *
   * Requirements 11.3, 11.4:
   *   - The level must exist.
   *   - Deletion is rejected atomically if any exercise references this level.
   *     The guard is checked before touching the database so that the record
   *     remains intact even if the error-reporting path fails.
   */
  async deleteLevel(id: number): Promise<void> {
    // 1. Ensure the level exists
    const level = await this.levelRepository.findById(id);
    if (level === null) {
      throw domainError({
        code: 'NOT_FOUND',
        message: `Level with id ${id} not found.`,
      });
    }

    // 2. Guard: reject atomically if exercises are associated.
    //    Count first — if > 0 throw BEFORE calling delete so the record is
    //    never touched regardless of whether the caller handles the error.
    const exerciseCount = await this.exerciseRepository.countByLevel(id);
    if (exerciseCount > 0) {
      throw domainError({
        code: 'HAS_ASSOCIATED_EXERCISES',
        message: `Level "${level.name}" cannot be deleted because it has ${exerciseCount} associated exercise(s).`,
      });
    }

    // 3. Safe to delete
    await this.levelRepository.delete(id);
  }

  /**
   * Returns all difficulty levels.
   *
   * Requirements 11.x (implied by list endpoint in design).
   */
  async listLevels(): Promise<Level[]> {
    return this.levelRepository.findAll();
  }

  // =========================================================================
  // CATEGORIES (Task 8.2)
  // =========================================================================

  /**
   * Creates a new thematic category.
   *
   * Requirements 12.1, 12.5:
   *   - Name must be non-empty.
   *   - Name must be unique across all categories.
   *   - Returns the persisted category with its assigned id.
   */
  async createCategory(name: string): Promise<Category> {
    // 1. Validate input
    if (!name || name.trim().length === 0) {
      throw domainError({
        code: 'VALIDATION_ERROR',
        message: 'Category name is required.',
        field: 'name',
      });
    }

    const trimmedName = name.trim();

    // 2. Check name uniqueness
    const existing = await this.categoryRepository.findByName(trimmedName);
    if (existing !== null) {
      throw domainError({
        code: 'NAME_ALREADY_EXISTS',
        message: `A category named "${trimmedName}" already exists.`,
        field: 'name',
      });
    }

    // 3. Persist and return
    return this.categoryRepository.create(trimmedName);
  }

  /**
   * Updates an existing category's name.
   *
   * Requirements 12.2, 12.5:
   *   - New name must be non-empty.
   *   - New name must not conflict with any other existing category.
   *   - Returns the updated category.
   */
  async updateCategory(id: number, name: string): Promise<Category> {
    // 1. Validate input
    if (!name || name.trim().length === 0) {
      throw domainError({
        code: 'VALIDATION_ERROR',
        message: 'Category name is required.',
        field: 'name',
      });
    }

    const trimmedName = name.trim();

    // 2. Ensure the category exists
    const category = await this.categoryRepository.findById(id);
    if (category === null) {
      throw domainError({
        code: 'NOT_FOUND',
        message: `Category with id ${id} not found.`,
      });
    }

    // 3. Check name uniqueness against other categories (allow keeping the same name)
    const conflicting = await this.categoryRepository.findByName(trimmedName);
    if (conflicting !== null && conflicting.id !== id) {
      throw domainError({
        code: 'NAME_ALREADY_EXISTS',
        message: `A category named "${trimmedName}" already exists.`,
        field: 'name',
      });
    }

    // 4. Persist and return
    return this.categoryRepository.update(id, trimmedName);
  }

  /**
   * Deletes a category.
   *
   * Requirements 12.3, 12.4:
   *   - The category must exist.
   *   - Deletion is rejected atomically if any exercise references this category.
   *     The guard is checked before touching the database so that the record
   *     remains intact even if the error-reporting path fails.
   */
  async deleteCategory(id: number): Promise<void> {
    // 1. Ensure the category exists
    const category = await this.categoryRepository.findById(id);
    if (category === null) {
      throw domainError({
        code: 'NOT_FOUND',
        message: `Category with id ${id} not found.`,
      });
    }

    // 2. Guard: reject atomically if exercises are associated.
    //    Count first — if > 0 throw BEFORE calling delete so the record is
    //    never touched regardless of whether the caller handles the error.
    const exerciseCount = await this.exerciseRepository.countByCategory(id);
    if (exerciseCount > 0) {
      throw domainError({
        code: 'HAS_ASSOCIATED_EXERCISES',
        message: `Category "${category.name}" cannot be deleted because it has ${exerciseCount} associated exercise(s).`,
      });
    }

    // 3. Safe to delete
    await this.categoryRepository.delete(id);
  }

  /**
   * Returns all thematic categories.
   *
   * Requirements 12.x (implied by list endpoint in design).
   */
  async listCategories(): Promise<Category[]> {
    return this.categoryRepository.findAll();
  }

  // =========================================================================
  // EXERCISES (Task 8.3)
  // =========================================================================

  /**
   * Creates a new exercise.
   *
   * Requirements 13.1, 13.5, 13.6, 13.7:
   *   - All required fields (title, description/enunciado, expected_solution,
   *     level_id, category_id) must be non-empty/present.
   *   - The referenced level must exist.
   *   - The referenced category must exist.
   *   - Returns the persisted exercise with its assigned id.
   */
  async createExercise(data: CreateExerciseDto): Promise<Exercise> {
    // 1. Validate required fields
    const requiredStringFields: Array<{ key: keyof CreateExerciseDto; label: string }> = [
      { key: 'title', label: 'title' },
      { key: 'description', label: 'description' },
      { key: 'enunciado', label: 'enunciado' },
      { key: 'expected_solution', label: 'expected_solution' },
    ];

    for (const { key, label } of requiredStringFields) {
      const value = data[key];
      if (typeof value === 'string' && value.trim().length === 0) {
        throw domainError({
          code: 'VALIDATION_ERROR',
          message: `Field "${label}" is required and cannot be empty.`,
          field: label,
        });
      }
      if (value === undefined || value === null) {
        throw domainError({
          code: 'VALIDATION_ERROR',
          message: `Field "${label}" is required.`,
          field: label,
        });
      }
    }

    if (data.level_id === undefined || data.level_id === null) {
      throw domainError({
        code: 'VALIDATION_ERROR',
        message: 'Field "level_id" is required.',
        field: 'level_id',
      });
    }

    if (data.category_id === undefined || data.category_id === null) {
      throw domainError({
        code: 'VALIDATION_ERROR',
        message: 'Field "category_id" is required.',
        field: 'category_id',
      });
    }

    // 2. Verify the referenced level exists
    const level = await this.levelRepository.findById(data.level_id);
    if (level === null) {
      throw domainError({
        code: 'INVALID_REFERENCE',
        message: `Level with id ${data.level_id} does not exist.`,
        field: 'level_id',
      });
    }

    // 3. Verify the referenced category exists
    const category = await this.categoryRepository.findById(data.category_id);
    if (category === null) {
      throw domainError({
        code: 'INVALID_REFERENCE',
        message: `Category with id ${data.category_id} does not exist.`,
        field: 'category_id',
      });
    }

    // 4. Persist and return.
    //    The DTO has both `description` (short summary) and `enunciado` (full
    //    problem statement). The Exercise entity stores the full statement in
    //    `description`. We combine them: description = enunciado (primary),
    //    keeping description as a fallback when enunciado equals description.
    return this.exerciseRepository.create({
      title: data.title.trim(),
      description: data.enunciado.trim(),
      expected_solution: data.expected_solution.trim(),
      score: data.score ?? 10,
      is_active: true,
      level_id: data.level_id,
      category_id: data.category_id,
    });
  }

  /**
   * Updates an existing exercise with partial data.
   *
   * Requirements 13.2, 13.5, 13.6:
   *   - The exercise must exist.
   *   - If level_id is supplied, the level must exist.
   *   - If category_id is supplied, the category must exist.
   *   - Returns the updated exercise.
   */
  async updateExercise(
    id: string,
    data: Partial<CreateExerciseDto>,
  ): Promise<Exercise> {
    // 1. Ensure the exercise exists
    const exercise = await this.exerciseRepository.findById(id);
    if (exercise === null) {
      throw domainError({
        code: 'NOT_FOUND',
        message: `Exercise with id "${id}" not found.`,
      });
    }

    // 2. Validate that supplied string fields are non-empty
    const updatableStringFields: Array<{ key: keyof CreateExerciseDto; label: string }> = [
      { key: 'title', label: 'title' },
      { key: 'description', label: 'description' },
      { key: 'enunciado', label: 'enunciado' },
      { key: 'expected_solution', label: 'expected_solution' },
    ];

    for (const { key, label } of updatableStringFields) {
      const value = data[key];
      if (value !== undefined && typeof value === 'string' && value.trim().length === 0) {
        throw domainError({
          code: 'VALIDATION_ERROR',
          message: `Field "${label}" cannot be set to an empty value.`,
          field: label,
        });
      }
    }

    // 3. Verify referenced level exists if supplied
    if (data.level_id !== undefined) {
      const level = await this.levelRepository.findById(data.level_id);
      if (level === null) {
        throw domainError({
          code: 'INVALID_REFERENCE',
          message: `Level with id ${data.level_id} does not exist.`,
          field: 'level_id',
        });
      }
    }

    // 4. Verify referenced category exists if supplied
    if (data.category_id !== undefined) {
      const category = await this.categoryRepository.findById(data.category_id);
      if (category === null) {
        throw domainError({
          code: 'INVALID_REFERENCE',
          message: `Category with id ${data.category_id} does not exist.`,
          field: 'category_id',
        });
      }
    }

    // 5. Build the partial update payload for the repository.
    //    `enunciado` maps to `description` in the entity.
    const updatePayload: Partial<Omit<Exercise, 'id' | 'created_at'>> = {};

    if (data.title !== undefined) {
      updatePayload.title = data.title.trim();
    }
    if (data.enunciado !== undefined) {
      updatePayload.description = data.enunciado.trim();
    } else if (data.description !== undefined) {
      updatePayload.description = data.description.trim();
    }
    if (data.expected_solution !== undefined) {
      updatePayload.expected_solution = data.expected_solution.trim();
    }
    if (data.score !== undefined) {
      updatePayload.score = data.score;
    }
    if (data.level_id !== undefined) {
      updatePayload.level_id = data.level_id;
    }
    if (data.category_id !== undefined) {
      updatePayload.category_id = data.category_id;
    }

    // 6. Persist and return
    return this.exerciseRepository.update(id, updatePayload);
  }

  /**
   * Deletes an exercise.
   *
   * Requirements 13.3, 13.4:
   *   - The exercise must exist.
   *   - Deletion is rejected atomically if any attempt references this exercise.
   *     The guard is checked before touching the database so that the record
   *     remains intact even if the error-reporting path fails.
   */
  async deleteExercise(id: string): Promise<void> {
    // 1. Ensure the exercise exists
    const exercise = await this.exerciseRepository.findById(id);
    if (exercise === null) {
      throw domainError({
        code: 'NOT_FOUND',
        message: `Exercise with id "${id}" not found.`,
      });
    }

    // 2. Guard: reject atomically if attempts are associated.
    //    Count first — if > 0 throw BEFORE calling delete so the record is
    //    never touched regardless of whether the caller handles the error.
    const attemptCount = await this.attemptRepository.countByExercise(id);
    if (attemptCount > 0) {
      throw domainError({
        code: 'HAS_ASSOCIATED_ATTEMPTS',
        message: `Exercise "${exercise.title}" cannot be deleted because it has ${attemptCount} recorded attempt(s).`,
      });
    }

    // 3. Safe to delete
    await this.exerciseRepository.delete(id);
  }

  /**
   * Returns ALL exercises (including inactive ones) for admin review.
   *
   * Requirements 13.x (implied by admin list endpoint in design).
   * Unlike the student-facing listExercises(), this does NOT filter by is_active.
   */
  async listExercisesAdmin(): Promise<Exercise[]> {
    // findAll with no filters returns every exercise regardless of is_active.
    return this.exerciseRepository.findAll();
  }
}
