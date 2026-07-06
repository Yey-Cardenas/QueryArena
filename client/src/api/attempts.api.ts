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

  const { data } = await apiClient.get<Attempt[]>('/attempts', { params });
  return data;
}
