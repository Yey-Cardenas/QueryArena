import { Attempt, AttemptStatus } from '../types';
import { apiClient } from './client';

export interface AttemptResult {
  attemptId: string;
  status: AttemptStatus;
  score: number;
  resolutionTimeMs: number;
  hint: string | null;
}

/** Raw shape returned by the backend (snake_case). */
interface AttemptResultRaw {
  attempt_id: string;
  status: AttemptStatus;
  score: number;
  resolution_time_ms: number;
  hint: string | null;
}

/** Raw shape of a history item returned by the backend (snake_case). */
interface AttemptHistoryRaw {
  id: string;
  exercise_id: string;
  exercise_title: string | null;
  query_sent: string;
  status: AttemptStatus;
  score: number;
  resolution_time_ms: number;
  created_at: string;
}

function mapHistoryItem(raw: AttemptHistoryRaw): Attempt {
  return {
    id: raw.id,
    userId: '',                          // not returned by history endpoint
    exerciseId: raw.exercise_id,
    exerciseTitle: raw.exercise_title ?? undefined,
    querySent: raw.query_sent,
    status: raw.status,
    score: raw.score,
    resolutionTimeMs: raw.resolution_time_ms,
    createdAt: raw.created_at,
  };
}

/**
 * Submit an SQL query attempt for an exercise.
 * POST /attempts
 */
export async function submitAttempt(
  exerciseId: string,
  querySent: string,
  resolutionTimeMs: number,
): Promise<AttemptResult> {
  const { data } = await apiClient.post<AttemptResultRaw>('/attempts', {
    exercise_id: exerciseId,
    query_sent: querySent,
    resolution_time_ms: resolutionTimeMs,
  });
  return {
    attemptId: data.attempt_id,
    status: data.status,
    score: data.score,
    resolutionTimeMs: data.resolution_time_ms,
    hint: data.hint,
  };
}

/**
 * Retrieve the authenticated user's attempt history.
 * GET /attempts
 *
 * @param exerciseId — optional filter to scope history to a single exercise
 */
export async function getAttemptHistory(exerciseId?: string): Promise<Attempt[]> {
  const params: Record<string, unknown> = {};
  if (exerciseId !== undefined) params['exercise_id'] = exerciseId;

  const { data } = await apiClient.get<AttemptHistoryRaw[]>('/attempts', { params });
  return data.map(mapHistoryItem);
}
