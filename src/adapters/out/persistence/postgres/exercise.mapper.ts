/**
 * exercise.mapper.ts
 * Maps a raw PostgreSQL row (from exercises JOIN levels JOIN categories)
 * to the Exercise domain entity.
 *
 * The mapper keeps adapter concerns out of the domain and out of the
 * repository implementation, following the single-responsibility principle.
 */

import type { Exercise, Level, Category } from '../../../../domain/entities/Exercise';

/**
 * Shape of the raw DB row returned by JOIN queries in PostgresExerciseRepository.
 * Column aliases must match the aliases used in SQL SELECT statements.
 */
export interface ExerciseRow {
  id: string;
  title: string;
  description: string;
  expected_solution: string;
  score: number;
  is_active: boolean;
  level_id: number;
  category_id: number;
  created_at: Date;
  updated_at: Date;
  // Joined from levels table
  level_name: string;
  level_created_at: Date;
  // Joined from categories table
  category_name: string;
  category_created_at: Date;
}

/**
 * Map a single DB row to an Exercise domain entity with embedded
 * Level and Category objects.
 *
 * @param row - Raw row from a JOIN query against exercises, levels, categories.
 * @returns An Exercise entity with populated `level` and `category` fields.
 */
export function mapRowToExercise(row: ExerciseRow): Exercise {
  const level: Level = {
    id: row.level_id,
    name: row.level_name,
    created_at: row.level_created_at,
  };

  const category: Category = {
    id: row.category_id,
    name: row.category_name,
    created_at: row.category_created_at,
  };

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    expected_solution: row.expected_solution,
    score: Number(row.score),
    is_active: row.is_active,
    level_id: row.level_id,
    category_id: row.category_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    level,
    category,
  };
}
