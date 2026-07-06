/**
 * Output port — IRankingRepository
 * Contract the domain requires from the ranking persistence adapter.
 * No external dependencies — imports only from domain entities.
 */

import type { Ranking } from '../../entities/Ranking';

export interface IRankingRepository {
  /**
   * Insert or update the ranking entry for the given user, incrementing
   * their accumulated score by `scoreIncrement` and refreshing last_correct_at.
   */
  upsert(userId: string, scoreIncrement: number): Promise<void>;

  /**
   * Return the full ranking list, enriched with each student's username.
   * Ordered by accumulated_score DESC; ties broken by last_correct_at ASC.
   */
  findAll(): Promise<(Ranking & { username: string })[]>;

  /**
   * Return the ranking entry for a single user.
   * Returns null when the user has no ranking record yet.
   */
  findByUser(userId: string): Promise<Ranking | null>;
}
