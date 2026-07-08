/**
 * Integration tests — User, Ranking and Dashboard endpoints
 *
 * Covers:
 *   User      GET  /api/users/me
 *             PATCH /api/users/me
 *   Ranking   GET  /api/ranking
 *   Dashboard GET  /api/dashboard/summary
 *             GET  /api/dashboard/progress/level
 *             GET  /api/dashboard/progress/category
 *             GET  /api/dashboard/history
 *
 * Strategy:
 *   1. Mock `infrastructure/container` so Postgres adapters are never instantiated.
 *   2. Mock `adapters/out/security/JWTAdapter` so authenticate works without real JWT.
 *   3. Cover: success, no token → 401, expired → 401, wrong role → 403, domain errors.
 */

// ---------------------------------------------------------------------------
// Env vars BEFORE any module with env.ts is imported
// ---------------------------------------------------------------------------
process.env.DATABASE_URL   = 'postgres://test:test@localhost:5432/test';
process.env.JWT_SECRET     = 'test-secret-key-for-integration';
process.env.JWT_EXPIRES_IN = '1h';
process.env.BCRYPT_COST    = '10';

// ---------------------------------------------------------------------------
// Mock JWTAdapter
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
// Mock DI container
// ---------------------------------------------------------------------------
import type { IUserUseCase } from '../../src/domain/ports/in/IUserUseCase';
import type { IRankingUseCase, RankingEntry } from '../../src/domain/ports/in/IRankingUseCase';
import type {
  IDashboardUseCase,
  DashboardSummary,
  LevelProgress,
  CategoryProgress,
  RecentAttempt,
} from '../../src/domain/ports/in/IDashboardUseCase';

const mockUserUseCase: jest.Mocked<IUserUseCase> = {
  getProfile: jest.fn(),
  updateProfile: jest.fn(),
};

const mockRankingUseCase: jest.Mocked<IRankingUseCase> = {
  getRanking: jest.fn(),
  updateScore: jest.fn(),
};

const mockDashboardUseCase: jest.Mocked<IDashboardUseCase> = {
  getSummary: jest.fn(),
  getProgressByLevel: jest.fn(),
  getProgressByCategory: jest.fn(),
  getRecentHistory: jest.fn(),
};

jest.mock('../../src/infrastructure/container', () => ({
  container: {
    authUseCase:     { register: jest.fn(), login: jest.fn() },
    userUseCase:     mockUserUseCase,
    exerciseUseCase: { listExercises: jest.fn(), getExerciseById: jest.fn() },
    attemptUseCase:  { submitAttempt: jest.fn(), getAttemptHistory: jest.fn() },
    rankingUseCase:  mockRankingUseCase,
    dashboardUseCase: mockDashboardUseCase,
    adminUseCase: {
      listLevels: jest.fn(), createLevel: jest.fn(), updateLevel: jest.fn(), deleteLevel: jest.fn(),
      listCategories: jest.fn(), createCategory: jest.fn(), updateCategory: jest.fn(), deleteCategory: jest.fn(),
      listExercisesAdmin: jest.fn(), createExercise: jest.fn(), updateExercise: jest.fn(), deleteExercise: jest.fn(),
    },
  },
}));

// ---------------------------------------------------------------------------
// Import app + supertest AFTER mocks
// ---------------------------------------------------------------------------
import request from 'supertest';
import { app } from '../../src/app';

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------
const STUDENT_TOKEN = 'Bearer valid-student-token';
const ADMIN_TOKEN   = 'Bearer valid-admin-token';
const STUDENT_UUID  = 'student-uuid-001';
const ADMIN_UUID    = 'admin-uuid-001';

beforeEach(() => {
  jest.clearAllMocks();

  mockVerify.mockImplementation((token: string) => {
    if (token === 'valid-student-token') {
      return { userId: STUDENT_UUID, role: 'student' as UserRole, exp: 9999999999 };
    }
    if (token === 'valid-admin-token') {
      return { userId: ADMIN_UUID, role: 'admin' as UserRole, exp: 9999999999 };
    }
    const { InvalidTokenError } = jest.requireActual(
      '../../src/adapters/out/security/JWTAdapter',
    ) as typeof import('../../src/adapters/out/security/JWTAdapter');
    throw new InvalidTokenError('Invalid token');
  });
});

// ===========================================================================
// GET /api/users/me
// ===========================================================================

describe('GET /api/users/me', () => {
  const sampleProfile = {
    username: 'alice',
    email: 'alice@example.com',
    created_at: new Date('2024-01-01T00:00:00.000Z'),
    role: 'student' as const,
  };

  it('200 — authenticated student → returns profile without password_hash', async () => {
    mockUserUseCase.getProfile.mockResolvedValue(sampleProfile);

    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', STUDENT_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      username: 'alice',
      email: 'alice@example.com',
      role: 'student',
    });
    expect(res.body.password_hash).toBeUndefined();
    expect(mockUserUseCase.getProfile).toHaveBeenCalledWith(STUDENT_UUID);
  });

  it('200 — authenticated admin → also returns profile', async () => {
    mockUserUseCase.getProfile.mockResolvedValue({
      ...sampleProfile,
      role: 'admin' as const,
      username: 'adminuser',
      email: 'admin@example.com',
    });

    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', ADMIN_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('admin');
    expect(mockUserUseCase.getProfile).toHaveBeenCalledWith(ADMIN_UUID);
  });

  it('401 — no Authorization header → 401 UNAUTHORIZED', async () => {
    const res = await request(app).get('/api/users/me');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(mockUserUseCase.getProfile).not.toHaveBeenCalled();
  });

  it('401 — invalid token → 401 UNAUTHORIZED', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', 'Bearer garbage');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('401 — expired token → 401 SESSION_EXPIRED', async () => {
    mockVerify.mockImplementation(() => {
      const { ExpiredTokenError } = jest.requireActual(
        '../../src/adapters/out/security/JWTAdapter',
      ) as typeof import('../../src/adapters/out/security/JWTAdapter');
      throw new ExpiredTokenError();
    });

    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', 'Bearer expired-token');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('SESSION_EXPIRED');
  });

  it('404 — use case throws USER_NOT_FOUND → 404', async () => {
    mockUserUseCase.getProfile.mockRejectedValue({
      code: 'USER_NOT_FOUND',
      message: 'User not found.',
    });

    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', STUDENT_TOKEN);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('USER_NOT_FOUND');
  });

  it('500 — unexpected error → 500 INTERNAL_SERVER_ERROR', async () => {
    mockUserUseCase.getProfile.mockRejectedValue(new Error('DB connection lost'));

    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', STUDENT_TOKEN);

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
  });
});

// ===========================================================================
// PATCH /api/users/me
// ===========================================================================

describe('PATCH /api/users/me', () => {
  const updatedProfile = {
    username: 'alice_new',
    email: 'alice@example.com',
    created_at: new Date('2024-01-01T00:00:00.000Z'),
    role: 'student' as const,
  };

  it('200 — update username → returns updated profile', async () => {
    mockUserUseCase.updateProfile.mockResolvedValue(updatedProfile);

    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', STUDENT_TOKEN)
      .send({ username: 'alice_new' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ username: 'alice_new' });
    expect(mockUserUseCase.updateProfile).toHaveBeenCalledWith(
      STUDENT_UUID,
      { username: 'alice_new', email: undefined },
    );
  });

  it('200 — update email → returns updated profile', async () => {
    const profileWithNewEmail = { ...updatedProfile, email: 'newemail@example.com' };
    mockUserUseCase.updateProfile.mockResolvedValue(profileWithNewEmail);

    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', STUDENT_TOKEN)
      .send({ email: 'newemail@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('newemail@example.com');
  });

  it('409 — username taken → 409 USERNAME_TAKEN', async () => {
    mockUserUseCase.updateProfile.mockRejectedValue({
      code: 'USERNAME_TAKEN',
      message: 'That username is already in use.',
      field: 'username',
    });

    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', STUDENT_TOKEN)
      .send({ username: 'takenuser' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('USERNAME_TAKEN');
  });

  it('409 — email taken → 409 EMAIL_TAKEN', async () => {
    mockUserUseCase.updateProfile.mockRejectedValue({
      code: 'EMAIL_TAKEN',
      message: 'That email is already registered.',
      field: 'email',
    });

    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', STUDENT_TOKEN)
      .send({ email: 'taken@example.com' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('422 — empty username → 422 VALIDATION_ERROR', async () => {
    mockUserUseCase.updateProfile.mockRejectedValue({
      code: 'VALIDATION_ERROR',
      message: 'Username cannot be empty.',
      field: 'username',
    });

    const res = await request(app)
      .patch('/api/users/me')
      .set('Authorization', STUDENT_TOKEN)
      .send({ username: '' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('401 — no token → 401 UNAUTHORIZED', async () => {
    const res = await request(app)
      .patch('/api/users/me')
      .send({ username: 'newname' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(mockUserUseCase.updateProfile).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// GET /api/ranking
// ===========================================================================

describe('GET /api/ranking', () => {
  const sampleRanking: RankingEntry[] = [
    { position: 1, username: 'alice', accumulated_score: 200 },
    { position: 2, username: 'bob',   accumulated_score: 100 },
    { position: 3, username: 'carol', accumulated_score: 50  },
  ];

  it('200 — authenticated student → returns ranking list', async () => {
    mockRankingUseCase.getRanking.mockResolvedValue(sampleRanking);

    const res = await request(app)
      .get('/api/ranking')
      .set('Authorization', STUDENT_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    expect(res.body[0]).toMatchObject({ position: 1, username: 'alice', accumulated_score: 200 });
    expect(res.body[1]).toMatchObject({ position: 2, username: 'bob',   accumulated_score: 100 });
    expect(mockRankingUseCase.getRanking).toHaveBeenCalledTimes(1);
  });

  it('200 — authenticated admin → also returns ranking list', async () => {
    mockRankingUseCase.getRanking.mockResolvedValue(sampleRanking);

    const res = await request(app)
      .get('/api/ranking')
      .set('Authorization', ADMIN_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
  });

  it('200 — empty ranking → returns empty array', async () => {
    mockRankingUseCase.getRanking.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/ranking')
      .set('Authorization', STUDENT_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('401 — no Authorization header → 401 UNAUTHORIZED', async () => {
    const res = await request(app).get('/api/ranking');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(mockRankingUseCase.getRanking).not.toHaveBeenCalled();
  });

  it('401 — invalid token → 401 UNAUTHORIZED', async () => {
    const res = await request(app)
      .get('/api/ranking')
      .set('Authorization', 'Bearer bad.token');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('401 — expired token → 401 SESSION_EXPIRED', async () => {
    mockVerify.mockImplementation(() => {
      const { ExpiredTokenError } = jest.requireActual(
        '../../src/adapters/out/security/JWTAdapter',
      ) as typeof import('../../src/adapters/out/security/JWTAdapter');
      throw new ExpiredTokenError();
    });

    const res = await request(app)
      .get('/api/ranking')
      .set('Authorization', 'Bearer expired');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('SESSION_EXPIRED');
  });

  it('500 — use case throws unexpected error → 500 INTERNAL_SERVER_ERROR', async () => {
    mockRankingUseCase.getRanking.mockRejectedValue(new Error('DB timeout'));

    const res = await request(app)
      .get('/api/ranking')
      .set('Authorization', STUDENT_TOKEN);

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
  });
});

// ===========================================================================
// GET /api/dashboard/summary
// ===========================================================================

describe('GET /api/dashboard/summary', () => {
  const sampleSummary: DashboardSummary = {
    total_attempted: 5,
    total_correct: 3,
    accumulated_score: 75,
    ranking_position: 2,
  };

  it('200 — authenticated student → returns summary', async () => {
    mockDashboardUseCase.getSummary.mockResolvedValue(sampleSummary);

    const res = await request(app)
      .get('/api/dashboard/summary')
      .set('Authorization', STUDENT_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      total_attempted: 5,
      total_correct: 3,
      accumulated_score: 75,
      ranking_position: 2,
    });
    expect(mockDashboardUseCase.getSummary).toHaveBeenCalledWith(STUDENT_UUID);
  });

  it('200 — student with no attempts → returns zero counters', async () => {
    mockDashboardUseCase.getSummary.mockResolvedValue({
      total_attempted: 0,
      total_correct: 0,
      accumulated_score: 0,
      ranking_position: 1,
    });

    const res = await request(app)
      .get('/api/dashboard/summary')
      .set('Authorization', STUDENT_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.total_attempted).toBe(0);
    expect(res.body.total_correct).toBe(0);
  });

  it('401 — no token → 401 UNAUTHORIZED', async () => {
    const res = await request(app).get('/api/dashboard/summary');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(mockDashboardUseCase.getSummary).not.toHaveBeenCalled();
  });

  it('403 — admin token on student-only route → 403 FORBIDDEN', async () => {
    const res = await request(app)
      .get('/api/dashboard/summary')
      .set('Authorization', ADMIN_TOKEN);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(mockDashboardUseCase.getSummary).not.toHaveBeenCalled();
  });

  it('500 — unexpected error → 500 INTERNAL_SERVER_ERROR', async () => {
    mockDashboardUseCase.getSummary.mockRejectedValue(new Error('DB failure'));

    const res = await request(app)
      .get('/api/dashboard/summary')
      .set('Authorization', STUDENT_TOKEN);

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
  });
});

// ===========================================================================
// GET /api/dashboard/progress/level
// ===========================================================================

describe('GET /api/dashboard/progress/level', () => {
  const sampleLevelProgress: LevelProgress[] = [
    { level_id: 1, level_name: 'Básico',       exercises_attempted: 3, exercises_correct: 2 },
    { level_id: 2, level_name: 'Intermedio',   exercises_attempted: 2, exercises_correct: 1 },
  ];

  it('200 — authenticated student → returns level progress', async () => {
    mockDashboardUseCase.getProgressByLevel.mockResolvedValue(sampleLevelProgress);

    const res = await request(app)
      .get('/api/dashboard/progress/level')
      .set('Authorization', STUDENT_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toMatchObject({ level_id: 1, level_name: 'Básico', exercises_attempted: 3, exercises_correct: 2 });
    expect(mockDashboardUseCase.getProgressByLevel).toHaveBeenCalledWith(STUDENT_UUID);
  });

  it('200 — no attempts → returns empty array', async () => {
    mockDashboardUseCase.getProgressByLevel.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/dashboard/progress/level')
      .set('Authorization', STUDENT_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('401 — no token → 401 UNAUTHORIZED', async () => {
    const res = await request(app).get('/api/dashboard/progress/level');
    expect(res.status).toBe(401);
    expect(mockDashboardUseCase.getProgressByLevel).not.toHaveBeenCalled();
  });

  it('403 — admin token → 403 FORBIDDEN', async () => {
    const res = await request(app)
      .get('/api/dashboard/progress/level')
      .set('Authorization', ADMIN_TOKEN);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

// ===========================================================================
// GET /api/dashboard/progress/category
// ===========================================================================

describe('GET /api/dashboard/progress/category', () => {
  const sampleCategoryProgress: CategoryProgress[] = [
    { category_id: 1, category_name: 'SELECT', exercises_attempted: 4, exercises_correct: 3 },
    { category_id: 2, category_name: 'JOIN',   exercises_attempted: 1, exercises_correct: 0 },
  ];

  it('200 — authenticated student → returns category progress', async () => {
    mockDashboardUseCase.getProgressByCategory.mockResolvedValue(sampleCategoryProgress);

    const res = await request(app)
      .get('/api/dashboard/progress/category')
      .set('Authorization', STUDENT_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toMatchObject({ category_id: 1, category_name: 'SELECT', exercises_attempted: 4, exercises_correct: 3 });
    expect(mockDashboardUseCase.getProgressByCategory).toHaveBeenCalledWith(STUDENT_UUID);
  });

  it('200 — no attempts → returns empty array', async () => {
    mockDashboardUseCase.getProgressByCategory.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/dashboard/progress/category')
      .set('Authorization', STUDENT_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('401 — no token → 401 UNAUTHORIZED', async () => {
    const res = await request(app).get('/api/dashboard/progress/category');
    expect(res.status).toBe(401);
    expect(mockDashboardUseCase.getProgressByCategory).not.toHaveBeenCalled();
  });

  it('403 — admin token → 403 FORBIDDEN', async () => {
    const res = await request(app)
      .get('/api/dashboard/progress/category')
      .set('Authorization', ADMIN_TOKEN);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

// ===========================================================================
// GET /api/dashboard/history
// ===========================================================================

describe('GET /api/dashboard/history', () => {
  const sampleHistory: RecentAttempt[] = [
    {
      attempt_id:     'attempt-1',
      exercise_title: 'Basic SELECT',
      status:         'correct',
      score:          10,
      created_at:     new Date('2024-06-10T10:00:00.000Z'),
    },
    {
      attempt_id:     'attempt-2',
      exercise_title: 'JOIN query',
      status:         'incorrect',
      score:          0,
      created_at:     new Date('2024-06-09T08:00:00.000Z'),
    },
  ];

  it('200 — authenticated student → returns recent history', async () => {
    mockDashboardUseCase.getRecentHistory.mockResolvedValue(sampleHistory);

    const res = await request(app)
      .get('/api/dashboard/history')
      .set('Authorization', STUDENT_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toMatchObject({
      attempt_id:     'attempt-1',
      exercise_title: 'Basic SELECT',
      status:         'correct',
      score:          10,
    });
    expect(mockDashboardUseCase.getRecentHistory).toHaveBeenCalledWith(STUDENT_UUID);
  });

  it('200 — no attempts → returns empty array', async () => {
    mockDashboardUseCase.getRecentHistory.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/dashboard/history')
      .set('Authorization', STUDENT_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('401 — no token → 401 UNAUTHORIZED', async () => {
    const res = await request(app).get('/api/dashboard/history');
    expect(res.status).toBe(401);
    expect(mockDashboardUseCase.getRecentHistory).not.toHaveBeenCalled();
  });

  it('403 — admin token → 403 FORBIDDEN', async () => {
    const res = await request(app)
      .get('/api/dashboard/history')
      .set('Authorization', ADMIN_TOKEN);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(mockDashboardUseCase.getRecentHistory).not.toHaveBeenCalled();
  });

  it('500 — unexpected error → 500 INTERNAL_SERVER_ERROR', async () => {
    mockDashboardUseCase.getRecentHistory.mockRejectedValue(new Error('unexpected'));

    const res = await request(app)
      .get('/api/dashboard/history')
      .set('Authorization', STUDENT_TOKEN);

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
  });
});
