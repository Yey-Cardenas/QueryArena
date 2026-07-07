/**
 * Integration tests — Attempt endpoints
 *
 * Tests POST /api/attempts and GET /api/attempts end-to-end through
 * Express routes → authenticate → authorize (student only) →
 * controllers → use case (mocked) → error handler.
 *
 * Strategy:
 *  1. Mock `infrastructure/container` so the Postgres adapters are never instantiated.
 *  2. Mock `adapters/out/security/JWTAdapter` so the authenticate middleware
 *     can verify tokens without real JWT validation.
 *  3. Cover: success, no token → 401, admin token → 403, domain errors → correct status.
 */

// ---------------------------------------------------------------------------
// Set required env vars BEFORE any module with env.ts is imported
// ---------------------------------------------------------------------------
process.env.DATABASE_URL   = 'postgres://test:test@localhost:5432/test';
process.env.JWT_SECRET     = 'test-secret-key-for-integration';
process.env.JWT_EXPIRES_IN = '1h';
process.env.BCRYPT_COST    = '10';

// ---------------------------------------------------------------------------
// Mock JWTAdapter so authenticate middleware works without real JWT validation
// ---------------------------------------------------------------------------
import type { UserRole } from '../../src/domain/entities/User';

const mockVerify = jest.fn();

jest.mock('../../src/adapters/out/security/JWTAdapter', () => {
  const { InvalidTokenError, ExpiredTokenError } = jest.requireActual(
    '../../src/adapters/out/security/JWTAdapter',
  ) as typeof import('../../src/adapters/out/security/JWTAdapter');

  return {
    InvalidTokenError,
    ExpiredTokenError,
    JWTAdapter: jest.fn().mockImplementation(() => ({
      sign: jest.fn(),
      verify: mockVerify,
    })),
  };
});

// ---------------------------------------------------------------------------
// Mock the DI container — must be done before importing app
// ---------------------------------------------------------------------------
import type { IAttemptUseCase, AttemptResult, AttemptHistoryItem } from '../../src/domain/ports/in/IAttemptUseCase';

const mockAttemptUseCase: jest.Mocked<IAttemptUseCase> = {
  submitAttempt: jest.fn(),
  getAttemptHistory: jest.fn(),
};

jest.mock('../../src/infrastructure/container', () => ({
  container: {
    authUseCase:      { register: jest.fn(), login: jest.fn() },
    userUseCase:      { getProfile: jest.fn(), updateProfile: jest.fn() },
    exerciseUseCase:  { listExercises: jest.fn(), getExerciseById: jest.fn() },
    attemptUseCase:   mockAttemptUseCase,
    rankingUseCase:   { getRanking: jest.fn() },
    dashboardUseCase: {
      getSummary: jest.fn(),
      getProgressByLevel: jest.fn(),
      getProgressByCategory: jest.fn(),
      getRecentHistory: jest.fn(),
    },
    adminUseCase: {
      listLevels: jest.fn(),
      createLevel: jest.fn(),
      updateLevel: jest.fn(),
      deleteLevel: jest.fn(),
      listCategories: jest.fn(),
      createCategory: jest.fn(),
      updateCategory: jest.fn(),
      deleteCategory: jest.fn(),
      listExercisesAdmin: jest.fn(),
      createExercise: jest.fn(),
      updateExercise: jest.fn(),
      deleteExercise: jest.fn(),
    },
  },
}));

// ---------------------------------------------------------------------------
// Import app + supertest AFTER mocks are established
// ---------------------------------------------------------------------------
import request from 'supertest';
import { app } from '../../src/app';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STUDENT_TOKEN = 'Bearer valid-student-token';
const ADMIN_TOKEN   = 'Bearer valid-admin-token';
const STUDENT_UUID  = 'student-uuid-001';

const sampleAttemptResult: AttemptResult = {
  attempt_id:         'attempt-uuid-1',
  status:             'correct',
  score:              10,
  resolution_time_ms: 3000,
  hint:               null,
};

const sampleHistoryItem: AttemptHistoryItem = {
  id:                 'attempt-uuid-1',
  exercise_id:        'exercise-uuid-1',
  query_sent:         'SELECT * FROM users;',
  status:             'correct',
  score:              10,
  resolution_time_ms: 3000,
  created_at:         new Date('2024-01-15T10:00:00Z'),
};

beforeEach(() => {
  jest.clearAllMocks();

  // Default: verify succeeds based on token value
  mockVerify.mockImplementation((token: string) => {
    if (token === 'valid-student-token') {
      return { userId: STUDENT_UUID, role: 'student' as UserRole, exp: 9999999999 };
    }
    if (token === 'valid-admin-token') {
      return { userId: 'admin-uuid-001', role: 'admin' as UserRole, exp: 9999999999 };
    }
    const { InvalidTokenError } = jest.requireActual(
      '../../src/adapters/out/security/JWTAdapter',
    ) as typeof import('../../src/adapters/out/security/JWTAdapter');
    throw new InvalidTokenError('Invalid token');
  });
});

// ---------------------------------------------------------------------------
// POST /api/attempts
// ---------------------------------------------------------------------------

describe('POST /api/attempts', () => {
  it('201 — authenticated student submits valid attempt → returns result', async () => {
    mockAttemptUseCase.submitAttempt.mockResolvedValue(sampleAttemptResult);

    const res = await request(app)
      .post('/api/attempts')
      .set('Authorization', STUDENT_TOKEN)
      .send({
        exercise_id:        'exercise-uuid-1',
        query_sent:         'SELECT * FROM users;',
        resolution_time_ms: 3000,
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      attempt_id:         'attempt-uuid-1',
      status:             'correct',
      score:              10,
      resolution_time_ms: 3000,
      hint:               null,
    });
    expect(mockAttemptUseCase.submitAttempt).toHaveBeenCalledWith(
      STUDENT_UUID,
      'exercise-uuid-1',
      'SELECT * FROM users;',
      3000,
    );
  });

  it('201 — incorrect attempt → returns status=incorrect, score=0, hint present', async () => {
    mockAttemptUseCase.submitAttempt.mockResolvedValue({
      ...sampleAttemptResult,
      status: 'incorrect',
      score: 0,
      hint: 'Check your WHERE clause.',
    });

    const res = await request(app)
      .post('/api/attempts')
      .set('Authorization', STUDENT_TOKEN)
      .send({
        exercise_id:        'exercise-uuid-1',
        query_sent:         'SELECT id FROM users;',
        resolution_time_ms: 5000,
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('incorrect');
    expect(res.body.score).toBe(0);
    expect(res.body.hint).toBe('Check your WHERE clause.');
  });

  it('401 — no Authorization header → 401 UNAUTHORIZED', async () => {
    const res = await request(app)
      .post('/api/attempts')
      .send({
        exercise_id:        'exercise-uuid-1',
        query_sent:         'SELECT * FROM users;',
        resolution_time_ms: 3000,
      });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(mockAttemptUseCase.submitAttempt).not.toHaveBeenCalled();
  });

  it('401 — invalid token → 401 UNAUTHORIZED', async () => {
    const res = await request(app)
      .post('/api/attempts')
      .set('Authorization', 'Bearer garbage-token')
      .send({
        exercise_id:        'exercise-uuid-1',
        query_sent:         'SELECT * FROM users;',
        resolution_time_ms: 3000,
      });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(mockAttemptUseCase.submitAttempt).not.toHaveBeenCalled();
  });

  it('403 — admin token → 403 FORBIDDEN (student-only route)', async () => {
    const res = await request(app)
      .post('/api/attempts')
      .set('Authorization', ADMIN_TOKEN)
      .send({
        exercise_id:        'exercise-uuid-1',
        query_sent:         'SELECT * FROM users;',
        resolution_time_ms: 3000,
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(mockAttemptUseCase.submitAttempt).not.toHaveBeenCalled();
  });

  it('404 — exercise not found → 404 EXERCISE_NOT_FOUND', async () => {
    mockAttemptUseCase.submitAttempt.mockRejectedValue({
      code: 'EXERCISE_NOT_FOUND',
      message: 'The exercise does not exist.',
    });

    const res = await request(app)
      .post('/api/attempts')
      .set('Authorization', STUDENT_TOKEN)
      .send({
        exercise_id:        'non-existent-uuid',
        query_sent:         'SELECT * FROM users;',
        resolution_time_ms: 3000,
      });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('EXERCISE_NOT_FOUND');
  });

  it('422 — empty query → 422 VALIDATION_ERROR (EMPTY_QUERY maps via errorHandler)', async () => {
    mockAttemptUseCase.submitAttempt.mockRejectedValue({
      code: 'VALIDATION_ERROR',
      message: 'Query cannot be empty.',
    });

    const res = await request(app)
      .post('/api/attempts')
      .set('Authorization', STUDENT_TOKEN)
      .send({
        exercise_id:        'exercise-uuid-1',
        query_sent:         '',
        resolution_time_ms: 0,
      });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('500 — unexpected error during submit → 500 INTERNAL_SERVER_ERROR', async () => {
    mockAttemptUseCase.submitAttempt.mockRejectedValue(new Error('DB connection lost'));

    const res = await request(app)
      .post('/api/attempts')
      .set('Authorization', STUDENT_TOKEN)
      .send({
        exercise_id:        'exercise-uuid-1',
        query_sent:         'SELECT 1;',
        resolution_time_ms: 1000,
      });

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
  });
});

// ---------------------------------------------------------------------------
// GET /api/attempts
// ---------------------------------------------------------------------------

describe('GET /api/attempts', () => {
  it('200 — authenticated student → returns attempt history', async () => {
    mockAttemptUseCase.getAttemptHistory.mockResolvedValue([sampleHistoryItem]);

    const res = await request(app)
      .get('/api/attempts')
      .set('Authorization', STUDENT_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      id:          'attempt-uuid-1',
      exercise_id: 'exercise-uuid-1',
      status:      'correct',
      score:       10,
    });
    expect(mockAttemptUseCase.getAttemptHistory).toHaveBeenCalledWith(
      STUDENT_UUID,
      undefined,
    );
  });

  it('200 — with exercise_id filter → passes filter to use case', async () => {
    mockAttemptUseCase.getAttemptHistory.mockResolvedValue([sampleHistoryItem]);

    const res = await request(app)
      .get('/api/attempts?exercise_id=exercise-uuid-1')
      .set('Authorization', STUDENT_TOKEN);

    expect(res.status).toBe(200);
    expect(mockAttemptUseCase.getAttemptHistory).toHaveBeenCalledWith(
      STUDENT_UUID,
      'exercise-uuid-1',
    );
  });

  it('200 — no attempts yet → returns empty array', async () => {
    mockAttemptUseCase.getAttemptHistory.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/attempts')
      .set('Authorization', STUDENT_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('401 — no Authorization header → 401 UNAUTHORIZED', async () => {
    const res = await request(app).get('/api/attempts');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(mockAttemptUseCase.getAttemptHistory).not.toHaveBeenCalled();
  });

  it('401 — invalid token → 401 UNAUTHORIZED', async () => {
    const res = await request(app)
      .get('/api/attempts')
      .set('Authorization', 'Bearer bad-token');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(mockAttemptUseCase.getAttemptHistory).not.toHaveBeenCalled();
  });

  it('401 — expired token → 401 SESSION_EXPIRED', async () => {
    mockVerify.mockImplementation(() => {
      const { ExpiredTokenError } = jest.requireActual(
        '../../src/adapters/out/security/JWTAdapter',
      ) as typeof import('../../src/adapters/out/security/JWTAdapter');
      throw new ExpiredTokenError();
    });

    const res = await request(app)
      .get('/api/attempts')
      .set('Authorization', 'Bearer expired-token');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('SESSION_EXPIRED');
    expect(mockAttemptUseCase.getAttemptHistory).not.toHaveBeenCalled();
  });

  it('403 — admin token → 403 FORBIDDEN (student-only route)', async () => {
    const res = await request(app)
      .get('/api/attempts')
      .set('Authorization', ADMIN_TOKEN);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(mockAttemptUseCase.getAttemptHistory).not.toHaveBeenCalled();
  });

  it('500 — unexpected error during history fetch → 500 INTERNAL_SERVER_ERROR', async () => {
    mockAttemptUseCase.getAttemptHistory.mockRejectedValue(new Error('DB timeout'));

    const res = await request(app)
      .get('/api/attempts')
      .set('Authorization', STUDENT_TOKEN);

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
  });
});
