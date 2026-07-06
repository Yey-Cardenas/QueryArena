/**
 * IRankingUseCase — Driving port for ranking operations.
 * Controllers depend on this interface, never on the concrete implementation.
 * No external dependencies — pure TypeScript types only.
 */

/** Single entry in the public ranking list. */
export interface RankingEntry {
  position: number;
  username: string;
  accumulated_score: number;
}

export interface IRankingUseCase {
  /**
   * Increments the accumulated score for the user by the given amount.
   * Called asynchronously after a correct attempt; must not block the student response.
   */
  updateScore(userId: string, score: number): Promise<void>;

  /**
   * Returns the full ranking ordered by accumulated_score DESC,
   * with ties broken by last_correct_at ASC.
   * Students with no correct attempts are included with score 0.
   */
  getRanking(): Promise<RankingEntry[]>;
}
