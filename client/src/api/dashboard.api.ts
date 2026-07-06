import { Attempt, DashboardSummary, ProgressByGroup } from '../types';
import { apiClient } from './client';

// ─── Raw backend shapes (snake_case) ─────────────────────────────────────────

interface DashboardSummaryRaw {
  total_attempted: number;
  total_correct: number;
  accumulated_score: number;
  ranking_position: number | null;
}

interface ProgressByGroupRaw {
  id: number;
  name: string;
  attempted: number;
  correct: number;
}

interface AttemptRaw {
  id: string;
  user_id: string;
  exercise_id: string;
  exercise_title?: string;
  query_sent: string;
  status: string;
  score: number;
  resolution_time_ms: number;
  created_at: string;
  hint?: string | null;
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function mapSummary(raw: DashboardSummaryRaw): DashboardSummary {
  return {
    totalAttempted: raw.total_attempted,
    totalCorrect: raw.total_correct,
    accumulatedScore: raw.accumulated_score,
    rankingPosition: raw.ranking_position,
  };
}

function mapProgress(raw: ProgressByGroupRaw): ProgressByGroup {
  return {
    id: raw.id,
    name: raw.name,
    attempted: raw.attempted,
    correct: raw.correct,
  };
}

function mapAttempt(raw: AttemptRaw): Attempt {
  return {
    id: raw.id,
    userId: raw.user_id,
    exerciseId: raw.exercise_id,
    exerciseTitle: raw.exercise_title,
    querySent: raw.query_sent,
    status: raw.status as Attempt['status'],
    score: raw.score,
    resolutionTimeMs: raw.resolution_time_ms,
    createdAt: raw.created_at,
    hint: raw.hint,
  };
}

// ─── API functions ────────────────────────────────────────────────────────────

/**
 * Get the student's top-level dashboard summary.
 * GET /dashboard/summary
 */
export async function getSummary(): Promise<DashboardSummary> {
  const { data } = await apiClient.get<DashboardSummaryRaw>('/dashboard/summary');
  return mapSummary(data);
}

/**
 * Get progress counters grouped by difficulty level.
 * GET /dashboard/progress/level
 */
export async function getProgressByLevel(): Promise<ProgressByGroup[]> {
  const { data } = await apiClient.get<ProgressByGroupRaw[]>('/dashboard/progress/level');
  return data.map(mapProgress);
}

/**
 * Get progress counters grouped by exercise category.
 * GET /dashboard/progress/category
 */
export async function getProgressByCategory(): Promise<ProgressByGroup[]> {
  const { data } = await apiClient.get<ProgressByGroupRaw[]>('/dashboard/progress/category');
  return data.map(mapProgress);
}

/**
 * Get the 10 most recent attempts for the authenticated student.
 * GET /dashboard/history
 */
export async function getRecentHistory(): Promise<Attempt[]> {
  const { data } = await apiClient.get<AttemptRaw[]>('/dashboard/history');
  return data.map(mapAttempt);
}
