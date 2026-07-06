/**
 * Output port — ILevelRepository
 * Contract the domain requires from the level persistence adapter.
 * No external dependencies — imports only from domain entities.
 */

import type { Level } from '../../entities/Exercise';

export interface ILevelRepository {
  /**
   * Return all difficulty levels.
   */
  findAll(): Promise<Level[]>;

  /**
   * Find a single level by its unique identifier.
   * Returns null when the level does not exist.
   */
  findById(id: number): Promise<Level | null>;

  /**
   * Find a level by its name.
   * Returns null when no level with that name exists.
   */
  findByName(name: string): Promise<Level | null>;

  /**
   * Persist a new level and return the created entity.
   */
  create(name: string): Promise<Level>;

  /**
   * Update an existing level's name.
   * Returns the updated entity.
   */
  update(id: number, name: string): Promise<Level>;

  /**
   * Permanently remove a level by its unique identifier.
   */
  delete(id: number): Promise<void>;
}
