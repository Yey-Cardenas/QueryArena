/**
 * Output port — ICategoryRepository
 * Contract the domain requires from the category persistence adapter.
 * No external dependencies — imports only from domain entities.
 */

import type { Category } from '../../entities/Exercise';

export interface ICategoryRepository {
  /**
   * Return all thematic categories.
   */
  findAll(): Promise<Category[]>;

  /**
   * Find a single category by its unique identifier.
   * Returns null when the category does not exist.
   */
  findById(id: number): Promise<Category | null>;

  /**
   * Find a category by its name.
   * Returns null when no category with that name exists.
   */
  findByName(name: string): Promise<Category | null>;

  /**
   * Persist a new category and return the created entity.
   */
  create(name: string): Promise<Category>;

  /**
   * Update an existing category's name.
   * Returns the updated entity.
   */
  update(id: number, name: string): Promise<Category>;

  /**
   * Permanently remove a category by its unique identifier.
   */
  delete(id: number): Promise<void>;
}
