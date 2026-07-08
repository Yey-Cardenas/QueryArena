import { Exercise, ExerciseDetail, Level, Category } from '../types';
import { apiClient } from './client';

export interface ExerciseFilters {
  levelId?: number;
  categoryId?: number;
}

// ─── Raw backend shapes ───────────────────────────────────────────────────────

interface ExerciseRaw {
  id: string;
  title: string;
  description: string;
  level: { id: number; name: string };
  category: { id: number; name: string };
  score: number;
  is_active: boolean;
  created_at: string;
}

interface ExerciseDetailRaw extends ExerciseRaw {
  enunciado: string;
  expected_solution?: string;
}

function mapExercise(raw: ExerciseRaw): Exercise {
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description,
    level: raw.level,
    category: raw.category,
    score: raw.score,
    isActive: raw.is_active,
    createdAt: raw.created_at,
  };
}

function mapExerciseDetail(raw: ExerciseDetailRaw): ExerciseDetail {
  return {
    ...mapExercise(raw),
    expectedSolution: raw.expected_solution,
  };
}

/**
 * List all active exercises, optionally filtered by level or category.
 * GET /exercises
 */
export async function listExercises(filters?: ExerciseFilters): Promise<Exercise[]> {
  const params: Record<string, unknown> = {};
  if (filters?.levelId !== undefined) params['level_id'] = filters.levelId;
  if (filters?.categoryId !== undefined) params['category_id'] = filters.categoryId;

  const { data } = await apiClient.get<ExerciseRaw[]>('/exercises', { params });
  return data.map(mapExercise);
}

/**
 * Get full detail for a single exercise.
 * GET /exercises/:id
 */
export async function getExercise(id: string): Promise<ExerciseDetail> {
  const { data } = await apiClient.get<ExerciseDetailRaw>(`/exercises/${id}`);
  return mapExerciseDetail(data);
}

/**
 * List all difficulty levels (available to students and admins).
 * GET /exercises/levels
 */
export async function listLevels(): Promise<Level[]> {
  const { data } = await apiClient.get<Level[]>('/exercises/levels');
  return data;
}

/**
 * List all categories (available to students and admins).
 * GET /exercises/categories
 */
export async function listCategories(): Promise<Category[]> {
  const { data } = await apiClient.get<Category[]>('/exercises/categories');
  return data;
}
