/**
 * RankingUseCase — application service for leaderboard / ranking operations.
 *
 * Pure domain logic: no framework imports, no infrastructure dependencies.
 * All I/O is delegated to injected output ports.
 *
 * Responsibilities:
 *  - updateScore: increment a student's accumulated score after a correct attempt.
 *    Must not block the student response on failure — errors are logged and the
 *    operation is retried asynchronously.
 *  - getRanking: return the full leaderboard ordered by accumulated_score DESC,
 *    ties broken by last_correct_at ASC. Students with no correct attempts are
 *    included with score 0.
 */

import type { IRankingUseCase, RankingEntry } from '../ports/in/IRankingUseCase';
import type { IRankingRepository } from '../ports/out/IRankingRepository';

// ---------------------------------------------------------------------------
// Domain error types
// ---------------------------------------------------------------------------

export interface DomainError {
  code: 'RANKING_UPDATE_FAILED';
  message: string;
}

// ---------------------------------------------------------------------------
// Async retry helper
// ---------------------------------------------------------------------------

/**
 * Retry `fn` up to `maxAttempts` times with exponential back-off.
 * Errors are swallowed after all retries are exhausted — callers are
 * responsible for logging the failure before invoking this helper.
 */
async function retryAsync(
  fn: () => Promise<void>,
  maxAttempts: number,
  delayMs: number,
): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await fn();
      return; // success
    } catch {
      if (attempt < maxAttempts) {
        await new Promise<void>((resolve) =>
          setTimeout(resolve, delayMs * attempt),
        );
      }
    }
  }
}

// ---------------------------------------------------------------------------
// RankingUseCase
// ---------------------------------------------------------------------------

export class RankingUseCase implements IRankingUseCase {
  constructor(
    private readonly rankingRepository: IRankingRepository,
    /** Optional logger injected at construction time (console by default). */
    private readonly logger: { error: (msg: string, ...args: unknown[]) => void } = console,
  ) {}

  // -------------------------------------------------------------------------
  // updateScore
  // -------------------------------------------------------------------------

  /**
   * Increment the student's accumulated score by `score` in a fire-and-forget
   * manner.  If the first attempt fails the operation is retried asynchronously
   * (up to 3 times) without blocking the caller.
   *
   * Requirements: 8.1, 8.2, 8.4
   */
  updateScore(userId: string, score: number): Promise<void> {
    const doUpsert = () => this.rankingRepository.upsert(userId, score);

    // Try once eagerly, but don't await the background retry chain.
    const task = doUpsert().catch((firstError: unknown) => {
      this.logger.error(
        '[RankingUseCase] updateScore failed on first attempt — scheduling async retry',
        { userId, score, error: firstError },
      );

      // Retry up to 3 more times in the background; do not propagate errors.
      retryAsync(doUpsert, 3, 200).catch((retryError: unknown) => {
        this.logger.error(
          '[RankingUseCase] updateScore failed after all retries',
          { userId, score, error: retryError },
        );
      });
    });

    // Return a resolved promise immediately so the caller is never blocked.
    void task;
    return Promise.resolve();
  }

  // -------------------------------------------------------------------------
  // getRanking
  // -------------------------------------------------------------------------

  /**
   * Returns the complete leaderboard.
   *
   * Ordering (delegated to the repository, which applies ORDER BY at the DB
   * level for efficiency):
   *   1. accumulated_score DESC
   *   2. last_correct_at ASC  (tie-break: whoever reached the score first)
   *
   * Students with no correct attempts are included with accumulated_score = 0.
   * Position numbers reflect the ordering above; students sharing the exact
   * same score AND last_correct_at share the same position number.
   *
   * Requirements: 8.3, 8.5, 10.1, 10.2, 10.3
   */
  async getRanking(): Promise<RankingEntry[]> {
    const rows = await this.rankingRepository.findAll();

    const entries: RankingEntry[] = [];
    let position = 1;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      // Determine if this row shares the same position as the previous one.
      // Two entries share a position when both accumulated_score AND
      // last_correct_at are identical (which implies the exact same tie-break
      // key, so they truly are equal).
      if (i > 0) {
        const prev = rows[i - 1];
        const sameScore = row.accumulated_score === prev.accumulated_score;
        const sameDate =
          row.last_correct_at === prev.last_correct_at ||
          (row.last_correct_at !== null &&
            prev.last_correct_at !== null &&
            row.last_correct_at.getTime() === prev.last_correct_at.getTime());

        if (!(sameScore && sameDate)) {
          // Advance position counter by 1 (dense ranking increment).
          position = i + 1;
        }
        // When tied, `position` is left unchanged (shared position).
      }

      entries.push({
        position,
        username: row.username,
        accumulated_score: row.accumulated_score,
      });
    }

    return entries;
  }
}
