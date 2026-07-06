import { Category, Exercise, ExerciseDetail, Level } from '../types';
import { apiClient } from './client';

// ─── Levels ──────────────────────────────────────────────────────────────────

/** Raw shape of a level as returned by the backend (snake_case). */
interface LevelRow {
  id: number;
  name: string;
  created_at?: string;
}

/** Map a backend level row to the frontend Level type. */
function mapLevel(row: LevelRow): Level {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
  };
}

/** GET /admin/levels — list all difficulty levels */
export async function listLevels(): Promise<Level[]> {
  const { data } = await apiClient.get<LevelRow[]>('/admin/levels');
  return data.map(mapLevel);
}

/** POST /admin/levels — create a new level */
export async function createLevel(payload: { name: string }): Promise<Level> {
  const { data } = await apiClient.post<LevelRow>('/admin/levels', payload);
  return mapLevel(data);
}

/** PATCH /admin/levels/:id — update an existing level */
export async function updateLevel(id: number, payload: { name: string }): Promise<Level> {
  const { data } = await apiClient.patch<LevelRow>(`/admin/levels/${id}`, payload);
  return mapLevel(data);
}

/** DELETE /admin/levels/:id — delete a level (fails if exercises exist) */
export async function deleteLevel(id: number): Promise<void> {
  await apiClient.delete(`/admin/levels/${id}`);
}

// ─── Categories ───────────────────────────────────────────────────────────────

/** GET /admin/categories — list all categories */
export async function listCategories(): Promise<Category[]> {
  const { data } = await apiClient.get<Category[]>('/admin/categories');
  return data;
}

/** POST /admin/categories — create a new category */
export async function createCategory(payload: { name: string }): Promise<Category> {
  const { data } = await apiClient.post<Category>('/admin/categories', payload);
  return data;
}

/** PATCH /admin/categories/:id — update an existing category */
export async function updateCategory(id: number, payload: { name: string }): Promise<Category> {
  const { data } = await apiClient.patch<Category>(`/admin/categories/${id}`, payload);
  return data;
}

/** DELETE /admin/categories/:id — delete a category (fails if exercises exist) */
export async function deleteCategory(id: number): Promise<void> {
  await apiClient.delete(`/admin/categories/${id}`);
}

// ─── Exercises (Admin) ────────────────────────────────────────────────────────

export interface CreateExercisePayload {
  title: string;
  description: string;
  expectedSolution: string;
  score: number;
  levelId: number;
  categoryId: number;
}

export interface UpdateExercisePayload {
  title?: string;
  description?: string;
  expectedSolution?: string;
  score?: number;
  levelId?: number;
  categoryId?: number;
  isActive?: boolean;
}

/** GET /admin/exercises — list all exercises (including inactive) */
export async function listExercisesAdmin(): Promise<ExerciseDetail[]> {
  interface ExerciseAdminRaw {
    id: string;
    title: string;
    description: string;
    level: { id: number; name: string };
    category: { id: number; name: string };
    score: number;
    is_active: boolean;
    created_at: string;
    expected_solution?: string;
  }
  const { data } = await apiClient.get<ExerciseAdminRaw[]>('/admin/exercises');
  return data.map((raw) => ({
    id: raw.id,
    title: raw.title,
    description: raw.description,
    level: raw.level,
    category: raw.category,
    score: raw.score,
    isActive: raw.is_active,
    createdAt: raw.created_at,
    expectedSolution: raw.expected_solution,
  }));
}

/** POST /admin/exercises — create a new exercise */
export async function createExercise(payload: CreateExercisePayload): Promise<Exercise> {
  const { data } = await apiClient.post<Exercise>('/admin/exercises', {
    title: payload.title,
    description: payload.description,
    enunciado: payload.description,   // backend requires both; enunciado = full statement
    expected_solution: payload.expectedSolution,
    score: payload.score,
    level_id: payload.levelId,
    category_id: payload.categoryId,
  });
  return data;
}

/** PATCH /admin/exercises/:id — update an existing exercise */
export async function updateExercise(
  id: string,
  payload: UpdateExercisePayload,
): Promise<ExerciseDetail> {
  const body: Record<string, unknown> = {};
  if (payload.title !== undefined) body['title'] = payload.title;
  if (payload.description !== undefined) {
    body['description'] = payload.description;
    body['enunciado'] = payload.description;   // keep in sync
  }
  if (payload.expectedSolution !== undefined) body['expected_solution'] = payload.expectedSolution;
  if (payload.score !== undefined) body['score'] = payload.score;
  if (payload.levelId !== undefined) body['level_id'] = payload.levelId;
  if (payload.categoryId !== undefined) body['category_id'] = payload.categoryId;
  if (payload.isActive !== undefined) body['is_active'] = payload.isActive;

  const { data } = await apiClient.patch<ExerciseDetail>(`/admin/exercises/${id}`, body);
  return data;
}

/** DELETE /admin/exercises/:id — delete an exercise (fails if attempts exist) */
export async function deleteExercise(id: string): Promise<void> {
  await apiClient.delete(`/admin/exercises/${id}`);
}
