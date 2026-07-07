/**
 * Integration tests — Exercise endpoints
 *
 * Tests GET /api/exercises and GET /api/exercises/:id end-to-end through
 * Express routes → authenticate middleware → authorize middleware →
 * controllers → use case (mocked) → error handler.
 *
 * Strategy:
 *  1. Mock `infrastructure/container` so the Postgres adapters are never instantiated.
 *  2. Mock `adapters/out/security/JWTAdapter` so the authenticate middleware
 *     can verify tokens without a real secret / real JWT library validation.
 */

// ---------------------------------------------------------------------------
// Set required env vars BEFORE any module with env.ts is imported
// ---------------------------------------------------------------------------
process.env.DATABASE_URL   = 'postgres://test:test@localhost:5432/test';
process.env.JWT_SECRET     = 'test-secret-key-for-integration';
process.env.JWT_EXPIRES_IN = '1h';
process.env.BCRYPT_COST    = '10';

// ---------------------------------------------------------------------------
// Mock JWTAdapter so authenticate middleware works without real JWT
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
import type { IExerciseUseCase, ExerciseSummary, ExerciseDetail } from '../../src/domain/ports/in/IExerciseUseCase';

const mockExerciseUseCase: jest.Mocked<IExerciseUseCase> = {
  listExercises: jest.fn(),
  getExerciseById: jest.fn(),
};

jest.mock('../../src/infrastructure/container', () => ({
  container: {
    authUseCase:      { register: jest.fn(), login: jest.fn() },
    userUseCase:      { getProfile: jest.fn(), updateProfile: jest.fn() },
    exerciseUseCase:  mockExerciseUseCase,
    attemptUseCase:   { submitAttempt: jest.fn(), getAttemptHistory: jest.fn() },
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

/** Token that the mocked JWTAdapter will accept as a valid student session. */
const STUDENT_TOKEN = 'Bearer valid-student-token';
const ADMIN_TOKEN   = 'Bearer valid-admin-token';

/** A pre-built exercise summary for use across tests. */
const sampleSummary: ExerciseSummary = {
  id:          'exercise-uuid-1',
  title:       'Basic SELECT',
  description: 'Retrieve all rows from the table.',
  level:       { id: 1, name: 'Básico' },
  category:    { id: 1, name: 'SELECT' },
};

const sampleDetail: ExerciseDetail = {
  ...sampleSummary,
  enunciado: 'Write a SELECT * statement.',
  score: 10,
};

beforeEach(() => {
  jest.clearAllMocks();

  // Default: verify succeeds as a student
  mockVerify.mockImplementation((token: string) => {
    if (token === 'valid-student-token') {
      return { userId: 'student-uuid', role: 'student' as UserRole, exp: 9999999999 };
    }
    if (token === 'valid-admin-token') {
      return { userId: 'admin-uuid', role: 'admin' as UserRole, exp: 9999999999 };
    }
    // Throw the same error the real JWTAdapter would throw
    const { InvalidTokenError } = jest.requireActual(
      '../../src/adapters/out/security/JWTAdapter',
    ) as typeof import('../../src/adapters/out/security/JWTAdapter');
    throw new InvalidTokenError('Invalid token');
  });
});

// ---------------------------------------------------------------------------
// GET /api/exercises
// ---------------------------------------------------------------------------

describe('GET /api/exercises', () => {
  it('200 — authenticated student → returns exercise list', async () => {
    mockExerciseUseCase.listExercises.mockResolvedValue([sampleSummary]);

    const res = await request(app)
      .get('/api/exercises')
      .set('Authorization', STUDENT_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([sampleSummary]);
    expect(mockExerciseUseCase.listExercises).toHaveBeenCalledWith({});
  });

  it('200 — with level_id filter → passes numeric filter to use case', async () => {
    mockExerciseUseCase.listExercises.mockResolvedValue([sampleSummary]);

    const res = await request(app)
      .get('/api/exercises?level_id=1')
      .set('Authorization', STUDENT_TOKEN);

    expect(res.status).toBe(200);
    expect(mockExerciseUseCase.listExercises).toHaveBeenCalledWith({ level_id: 1 });
  });

  it('200 — with category_id filter → passes numeric filter to use case', async () => {
    mockExerciseUseCase.listExercises.mockResolvedValue([sampleSummary]);

    const res = await request(app)
      .get('/api/exercises?category_id=2')
      .set('Authorization', STUDENT_TOKEN);

    expect(res.status).toBe(200);
    expect(mockExerciseUseCase.listExercises).toHaveBeenCalledWith({ category_id: 2 });
  });

  it('200 — authenticated admin → also allowed (student OR admin)', async () => {
    mockExerciseUseCase.listExercises.mockResolvedValue([sampleSummary]);

    const res = await request(app)
      .get('/api/exercises')
      .set('Authorization', ADMIN_TOKEN);

    expect(res.status).toBe(200);
  });

  it('401 — no Authorization header → 401 UNAUTHORIZED', async () => {
    const res = await request(app).get('/api/exercises');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(mockExerciseUseCase.listExercises).not.toHaveBeenCalled();
  });

  it('401 — invalid token → 401 UNAUTHORIZED', async () => {
    const res = await request(app)
      .get('/api/exercises')
      .set('Authorization', 'Bearer invalid-garbage-token');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(mockExerciseUseCase.listExercises).not.toHaveBeenCalled();
  });

  it('401 — expired token → 401 SESSION_EXPIRED', async () => {
    mockVerify.mockImplementation(() => {
      const { ExpiredTokenError } = jest.requireActual(
        '../../src/adapters/out/security/JWTAdapter',
      ) as typeof import('../../src/adapters/out/security/JWTAdapter');
      throw new ExpiredTokenError();
    });

    const res = await request(app)
      .get('/api/exercises')
      .set('Authorization', 'Bearer expired-token');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('SESSION_EXPIRED');
    expect(mockExerciseUseCase.listExercises).not.toHaveBeenCalled();
  });

  it('200 — empty list when no active exercises', async () => {
    mockExerciseUseCase.listExercises.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/exercises')
      .set('Authorization', STUDENT_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('500 — use case throws unexpected error → 500 INTERNAL_SERVER_ERROR', async () => {
    mockExerciseUseCase.listExercises.mockRejectedValue(new Error('DB failure'));

    const res = await request(app)
      .get('/api/exercises')
      .set('Authorization', STUDENT_TOKEN);

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
  });
});

// ---------------------------------------------------------------------------
// GET /api/exercises/:id
// ---------------------------------------------------------------------------

describe('GET /api/exercises/:id', () => {
  it('200 — authenticated student, valid id → returns exercise detail', async () => {
    mockExerciseUseCase.getExerciseById.mockResolvedValue(sampleDetail);

    const res = await request(app)
      .get('/api/exercises/exercise-uuid-1')
      .set('Authorization', STUDENT_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id:       'exercise-uuid-1',
      title:    'Basic SELECT',
      enunciado: 'Write a SELECT * statement.',
      score:    10,
    });
    expect(mockExerciseUseCase.getExerciseById).toHaveBeenCalledWith('exercise-uuid-1');
  });

  it('404 — exercise not found → 404 EXERCISE_NOT_FOUND', async () => {
    mockExerciseUseCase.getExerciseById.mockRejectedValue({
      code: 'EXERCISE_NOT_FOUND',
      message: 'Exercise not found.',
    });

    const res = await request(app)
      .get('/api/exercises/non-existent-uuid')
      .set('Authorization', STUDENT_TOKEN);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('EXERCISE_NOT_FOUND');
  });

  it('401 — no Authorization header → 401 UNAUTHORIZED', async () => {
    const res = await request(app).get('/api/exercises/some-id');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(mockExerciseUseCase.getExerciseById).not.toHaveBeenCalled();
  });

  it('401 — invalid token → 401 UNAUTHORIZED', async () => {
    const res = await request(app)
      .get('/api/exercises/some-id')
      .set('Authorization', 'Bearer bad-token');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(mockExerciseUseCase.getExerciseById).not.toHaveBeenCalled();
  });

  it('200 — authenticated admin can also access exercise detail', async () => {
    mockExerciseUseCase.getExerciseById.mockResolvedValue(sampleDetail);

    const res = await request(app)
      .get('/api/exercises/exercise-uuid-1')
      .set('Authorization', ADMIN_TOKEN);

    expect(res.status).toBe(200);
  });
});
