import { RankingEntry } from '../types';
import { apiClient } from './client';

/** Raw shape returned by the backend (snake_case). */
interface RankingEntryRaw {
  position: number;
  username: string;
  accumulated_score: number;
}

/**
 * Retrieve the full ranking leaderboard.
 * GET /ranking
 */
export async function getRanking(): Promise<RankingEntry[]> {
  const { data } = await apiClient.get<RankingEntryRaw[]>('/ranking');
  return data.map((entry) => ({
    position: entry.position,
    username: entry.username,
    accumulatedScore: entry.accumulated_score,
  }));
}
