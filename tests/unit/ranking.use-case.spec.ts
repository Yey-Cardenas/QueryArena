/**
 * Unit tests for RankingUseCase
 * All ports are mocked with jest.fn() — no real database.
 *
 * Requirements covered: 8.2, 10.3
 */

import { RankingUseCase } from '../../src/domain/use-cases/RankingUseCase';
import type { IRankingRepository } from '../../src/domain/ports/out/IRankingRepository';
import type { Ranking } from '../../src/domain/entities/Ranking';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRankingRow(
  overrides: Partial<Ranking & { username: string }> = {},
): Ranking & { username: string } {
  return {
    id: 'ranking-id-1',
    user_id: 'user-id-1',
    username: 'student1',
    accumulated_score: 100,
    last_correct_at: new Date('2024-01-01T10:00:00.000Z'),
    updated_at: new Date('2024-01-01T10:00:00.000Z'),
    ...overrides,
  };
}

function makeMocks() {
  const rankingRepository: jest.Mocked<IRankingRepository> = {
    upsert: jest.fn(),
    findAll: jest.fn(),
    findByUser: jest.fn(),
  };

  const mockLogger = {
    error: jest.fn(),
  };

  const useCase = new RankingUseCase(rankingRepository, mockLogger);

  return { useCase, rankingRepository, mockLogger };
}

// ---------------------------------------------------------------------------
// getRanking()
// ---------------------------------------------------------------------------

describe('RankingUseCase.getRanking()', () => {
  it('1. empty repository → returns empty array', async () => {
    const { useCase, rankingRepository } = makeMocks();

    rankingRepository.findAll.mockResolvedValue([]);

    const result = await useCase.getRanking();

    expect(result).toEqual([]);
  });

  it('2. single student with score > 0 → position 1, correct username and score', async () => {
    const { useCase, rankingRepository } = makeMocks();

    rankingRepository.findAll.mockResolvedValue([
      makeRankingRow({ user_id: 'user-1', username: 'alice', accumulated_score: 50 }),
    ]);

    const result = await useCase.getRanking();

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      position: 1,
      username: 'alice',
      accumulated_score: 50,
    });
  });

  it('3. two students with different scores → higher score gets position 1', async () => {
    const { useCase, rankingRepository } = makeMocks();

    rankingRepository.findAll.mockResolvedValue([
      makeRankingRow({ user_id: 'user-1', username: 'alice', accumulated_score: 200 }),
      makeRankingRow({ user_id: 'user-2', username: 'bob', accumulated_score: 100 }),
    ]);

    const result = await useCase.getRanking();

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ position: 1, username: 'alice', accumulated_score: 200 });
    expect(result[1]).toMatchObject({ position: 2, username: 'bob', accumulated_score: 100 });
  });

  it('4. two students with same score, different last_correct_at → earlier date gets position 1 (tie-break ASC)', async () => {
    const { useCase, rankingRepository } = makeMocks();

    // Repository returns them already sorted: earlier last_correct_at first
    rankingRepository.findAll.mockResolvedValue([
      makeRankingRow({
        user_id: 'user-1',
        username: 'alice',
        accumulated_score: 100,
        last_correct_at: new Date('2024-01-01T08:00:00.000Z'), // earlier → wins tie
      }),
      makeRankingRow({
        user_id: 'user-2',
        username: 'bob',
        accumulated_score: 100,
        last_correct_at: new Date('2024-01-02T08:00:00.000Z'), // later → loses tie
      }),
    ]);

    const result = await useCase.getRanking();

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ position: 1, username: 'alice' });
    expect(result[1]).toMatchObject({ position: 2, username: 'bob' });
  });

  it('5. students with same score AND same last_correct_at → both share position 1', async () => {
    const { useCase, rankingRepository } = makeMocks();

    const sharedDate = new Date('2024-01-01T10:00:00.000Z');

    rankingRepository.findAll.mockResolvedValue([
      makeRankingRow({
        user_id: 'user-1',
        username: 'alice',
        accumulated_score: 100,
        last_correct_at: sharedDate,
      }),
      makeRankingRow({
        user_id: 'user-2',
        username: 'bob',
        accumulated_score: 100,
        last_correct_at: sharedDate,
      }),
    ]);

    const result = await useCase.getRanking();

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ position: 1, username: 'alice' });
    expect(result[1]).toMatchObject({ position: 1, username: 'bob' });
  });

  it('6. students with score 0 are included in the ranking (Req 10.3)', async () => {
    const { useCase, rankingRepository } = makeMocks();

    rankingRepository.findAll.mockResolvedValue([
      makeRankingRow({
        user_id: 'user-1',
        username: 'alice',
        accumulated_score: 50,
        last_correct_at: new Date('2024-01-01T10:00:00.000Z'),
      }),
      makeRankingRow({
        user_id: 'user-2',
        username: 'bob',
        accumulated_score: 0,
        last_correct_at: null,
      }),
    ]);

    const result = await useCase.getRanking();

    expect(result).toHaveLength(2);
    // Bob with score 0 must appear in results
    expect(result.some((e) => e.username === 'bob' && e.accumulated_score === 0)).toBe(true);
  });

  it('7. all students have score 0 → all at position 1 (shared) (Req 10.3)', async () => {
    const { useCase, rankingRepository } = makeMocks();

    const nullDate = null;
    rankingRepository.findAll.mockResolvedValue([
      makeRankingRow({ user_id: 'user-1', username: 'alice', accumulated_score: 0, last_correct_at: nullDate }),
      makeRankingRow({ user_id: 'user-2', username: 'bob', accumulated_score: 0, last_correct_at: nullDate }),
      makeRankingRow({ user_id: 'user-3', username: 'charlie', accumulated_score: 0, last_correct_at: nullDate }),
    ]);

    const result = await useCase.getRanking();

    expect(result).toHaveLength(3);
    expect(result.every((e) => e.position === 1)).toBe(true);
  });

  it('8. three students: scores [100, 50, 0] → positions [1, 2, 3] (Req 10.3)', async () => {
    const { useCase, rankingRepository } = makeMocks();

    rankingRepository.findAll.mockResolvedValue([
      makeRankingRow({ user_id: 'user-1', username: 'alice', accumulated_score: 100, last_correct_at: new Date('2024-01-01T10:00:00.000Z') }),
      makeRankingRow({ user_id: 'user-2', username: 'bob', accumulated_score: 50, last_correct_at: new Date('2024-01-02T10:00:00.000Z') }),
      makeRankingRow({ user_id: 'user-3', username: 'charlie', accumulated_score: 0, last_correct_at: null }),
    ]);

    const result = await useCase.getRanking();

    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({ position: 1, username: 'alice', accumulated_score: 100 });
    expect(result[1]).toMatchObject({ position: 2, username: 'bob', accumulated_score: 50 });
    expect(result[2]).toMatchObject({ position: 3, username: 'charlie', accumulated_score: 0 });
  });
});

// ---------------------------------------------------------------------------
// updateScore()
// ---------------------------------------------------------------------------

describe('RankingUseCase.updateScore()', () => {
  it('9. calls rankingRepository.upsert with correct userId and score (Req 8.2)', async () => {
    const { useCase, rankingRepository } = makeMocks();

    rankingRepository.upsert.mockResolvedValue(undefined);

    await useCase.updateScore('user-id-1', 25);

    // Give the fire-and-forget micro-task a tick to execute
    await new Promise<void>((resolve) => setTimeout(resolve, 10));

    expect(rankingRepository.upsert).toHaveBeenCalledWith('user-id-1', 25);
  });

  it('10. returns resolved promise immediately (does not block on upsert)', async () => {
    const { useCase, rankingRepository } = makeMocks();

    // Simulate a slow upsert that takes 200 ms
    rankingRepository.upsert.mockImplementation(
      () => new Promise<void>((resolve) => setTimeout(resolve, 200)),
    );

    const start = Date.now();
    await useCase.updateScore('user-id-1', 10);
    const elapsed = Date.now() - start;

    // Should resolve well before the 200 ms upsert completes
    expect(elapsed).toBeLessThan(100);
  });

  it('11. first upsert fails → still returns resolved promise without throwing (fire-and-forget)', async () => {
    const { useCase, rankingRepository } = makeMocks();

    rankingRepository.upsert.mockRejectedValue(new Error('DB connection lost'));

    await expect(useCase.updateScore('user-id-1', 15)).resolves.toBeUndefined();
  });
});
