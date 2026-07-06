/**
 * AttemptUseCase — application service for submitting and querying SQL attempts.
 *
 * Pure domain logic: no framework imports, no infrastructure dependencies.
 * All I/O is delegated to injected output ports.
 *
 * Responsibilities:
 *  - submitAttempt: validate input, verify exercise exists, persist a new attempt,
 *    delegate evaluation to ResultUseCase, update ranking on correct answers, return result.
 *  - getAttemptHistory: return a student's attempts ordered by created_at DESC,
 *    optionally filtered to a single exercise.
 */

import type { IAttemptUseCase, AttemptResult, AttemptHistoryItem } from '../ports/in/IAttemptUseCase';
import type { IAttemptRepository } from '../ports/out/IAttemptRepository';
import type { IExerciseRepository } from '../ports/out/IExerciseRepository';
import type { IRankingRepository } from '../ports/out/IRankingRepository';
import type { IResultUseCase } from '../ports/in/IResultUseCase';

// ---------------------------------------------------------------------------
// Domain error types (shared shape with other use cases)
// ---------------------------------------------------------------------------

export interface DomainError {
  code: 'EMPTY_QUERY' | 'EXERCISE_NOT_FOUND' | 'ATTEMPT_SAVE_FAILED';
  message: string;
  field?: string;
}

function domainError(err: DomainError): DomainError {
  return err;
}

// ---------------------------------------------------------------------------
// AttemptUseCase
// ---------------------------------------------------------------------------

export class AttemptUseCase implements IAttemptUseCase {
  constructor(
    private readonly attemptRepository: IAttemptRepository,
    private readonly exerciseRepository: IExerciseRepository,
    private readonly rankingRepository: IRankingRepository,
    private readonly resultUseCase: IResultUseCase,
  ) {}

  // -------------------------------------------------------------------------
  // submitAttempt
  // -------------------------------------------------------------------------

  async submitAttempt(
    userId: string,
    exerciseId: string,
    querySent: string,
    resolutionTimeMs: number,
  ): Promise<AttemptResult> {
    // 1. Reject blank queries (Requirement 5.8)
    if (!querySent || querySent.trim().length === 0) {
      throw domainError({
        code: 'EMPTY_QUERY',
        message: 'The SQL query cannot be empty.',
        field: 'query',
      });
    }

    // 2. Verify the exercise exists (Requirement 5.6)
    const exercise = await this.exerciseRepository.findById(exerciseId);
    if (exercise === null) {
      throw domainError({
        code: 'EXERCISE_NOT_FOUND',
        message: 'The specified exercise does not exist.',
      });
    }

    // 3. Persist the attempt with a preliminary status of 'incorrect' (score=0).
    //    ResultUseCase will update status and score once evaluation completes.
    //    (Requirement 5.1, 6.1)
    const attempt = await this.attemptRepository.create({
      user_id: userId,
      exercise_id: exerciseId,
      query_sent: querySent,
      status: 'incorrect',
      score: 0,
      resolution_time_ms: resolutionTimeMs,
    });

    // 4. Evaluate the attempt via ResultUseCase.
    //    ResultUseCase persists the final status/score on the attempt record.
    //    (Requirements 5.2, 5.3, 5.4, 7.1–7.4)
    const evaluation = await this.resultUseCase.evaluateAttempt(
      attempt.id,
      querySent,
      exercise.expected_solution,
      exercise.score,
    );

    // 5. If the attempt was correct, update the student's ranking score.
    //    Fire-and-forget: ranking update must not block the response to the student.
    //    Errors are caught and logged without re-throwing. (Requirement 8.1, 8.4)
    if (evaluation.status === 'correct') {
      this.rankingRepository
        .upsert(userId, evaluation.score)
        .catch((err: unknown) => {
          // Log the failure — ranking will need to be retried externally.
          // We intentionally do not block the response here.
          console.error(
            `[AttemptUseCase] Failed to update ranking for user ${userId} after correct attempt ${attempt.id}:`,
            err,
          );
        });
    }

    // 6. Return the combined result to the caller (Requirement 7.1)
    return {
      attempt_id: attempt.id,
      status: evaluation.status,
      score: evaluation.score,
      resolution_time_ms: resolutionTimeMs,
      hint: evaluation.hint,
    };
  }

  // -------------------------------------------------------------------------
  // getAttemptHistory
  // -------------------------------------------------------------------------

  async getAttemptHistory(
    userId: string,
    exerciseId?: string,
  ): Promise<AttemptHistoryItem[]> {
    // Delegate filtering and ordering (created_at DESC) to the repository.
    // (Requirements 6.2, 6.3)
    const attempts = await this.attemptRepository.findByUser(userId, exerciseId);

    return attempts.map((attempt) => ({
      id: attempt.id,
      exercise_id: attempt.exercise_id,
      query_sent: attempt.query_sent,
      status: attempt.status,
      score: attempt.score,
      resolution_time_ms: attempt.resolution_time_ms,
      created_at: attempt.created_at,
    }));
  }
}
