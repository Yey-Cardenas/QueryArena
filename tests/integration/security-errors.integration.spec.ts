/**
 * Integration tests — Security & Error constraint endpoints
 *
 * Covers:
 *   Security / Auth (Requirements 14.1, 14.2, 14.3):
 *     - No token → 401 UNAUTHORIZED
 *     - Expired token → 401 SESSION_EXPIRED
 *     - Tampered/invalid token → 401 UNAUTHORIZED
 *     - Student accessing admin route → 403 FORBIDDEN
 *     - Admin accessing student-only route → 403 FORBIDDEN
 *
 *   Business constraints (Requirements 11.4, 12.4, 13.4):
 *     - DELETE level with exercises → 422 HAS_ASSOCIATED_EXERCISES
 *     - DELETE category with exercises → 422 HAS_ASSOCIATED_EXERCISES
 *     - DELETE exercise with attempts → 422 HAS_ASSOCIATED_ATTEMPTS
 *
 * Note: The errorHandler maps HAS_ASSOCIATED_EXERCISES and HAS_ASSOCIATED_ATTEMPTS
 * to HTTP 422 (not 409) as defined in src/adapters/in/http/middlewares/errorHandler.ts.
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
jest.mock('../../src/infrastructure/container', () => ({
  container: {
    authUseCase:      { register: jest.fn(), login: jest.fn() },
    userUseCase:      { getProfile: jest.fn(), updateProfile: jest.fn() },
    exerciseUseCase:  { listExercises: jest.fn(), getExerciseById: jest.fn() },
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
import { container } from '../../src/infrastructure/container';
import type { IAdminUseCase } from '../../src/domain/ports/in/IAdminUseCase';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STUDENT_TOKEN = 'Bearer valid-student-token';
const ADMIN_TOKEN   = 'Bearer valid-admin-token';

const mockAdminUseCase = container.adminUseCase as unknown as jest.Mocked<IAdminUseCase>;

beforeEach(() => {
  jest.clearAllMocks();

  mockVerify.mockImplementation((token: string) => {
    if (token === 'valid-student-token') {
      return { userId: 'student-uuid-001', role: 'student' as UserRole, exp: 9999999999 };
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
// Security / Auth tests — Requirement 14.1
// ---------------------------------------------------------------------------

describe('Auth — protected route without any token', () => {
  it('401 UNAUTHORIZED — GET /api/exercises with no Authorization header', async () => {
    const res = await request(app).get('/api/exercises');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('401 UNAUTHORIZED — GET /api/admin/levels with no Authorization header', async () => {
    const res = await request(app).get('/api/admin/levels');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('401 UNAUTHORIZED — POST /api/attempts with no Authorization header', async () => {
    const res = await request(app)
      .post('/api/attempts')
      .send({ exercise_id: 'ex-1', query_sent: 'SELECT 1;', resolution_time_ms: 100 });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

// ---------------------------------------------------------------------------
// Security / Auth tests — Expired JWT → 401 SESSION_EXPIRED
// ---------------------------------------------------------------------------

describe('Auth — expired JWT', () => {
  beforeEach(() => {
    mockVerify.mockImplementation(() => {
      const { ExpiredTokenError } = jest.requireActual(
        '../../src/adapters/out/security/JWTAdapter',
      ) as typeof import('../../src/adapters/out/security/JWTAdapter');
      throw new ExpiredTokenError();
    });
  });

  it('401 SESSION_EXPIRED — GET /api/exercises with expired token', async () => {
    const res = await request(app)
      .get('/api/exercises')
      .set('Authorization', 'Bearer expired-token');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('SESSION_EXPIRED');
  });

  it('401 SESSION_EXPIRED — GET /api/admin/levels with expired token', async () => {
    const res = await request(app)
      .get('/api/admin/levels')
      .set('Authorization', 'Bearer expired-token');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('SESSION_EXPIRED');
  });
});

// ---------------------------------------------------------------------------
// Security / Auth tests — Tampered/invalid JWT → 401 UNAUTHORIZED
// ---------------------------------------------------------------------------

describe('Auth — tampered or invalid JWT', () => {
  it('401 UNAUTHORIZED — GET /api/exercises with a garbage token string', async () => {
    const res = await request(app)
      .get('/api/exercises')
      .set('Authorization', 'Bearer this.is.garbage');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('401 UNAUTHORIZED — DELETE /api/admin/levels/1 with a tampered token', async () => {
    const res = await request(app)
      .delete('/api/admin/levels/1')
      .set('Authorization', 'Bearer tampered.jwt.payload');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

// ---------------------------------------------------------------------------
// Security / Auth tests — Requirement 14.2: Student accessing admin route → 403
// ---------------------------------------------------------------------------

describe('Auth — student token accessing admin route (Requirement 14.2)', () => {
  it('403 FORBIDDEN — GET /api/admin/levels with student token', async () => {
    const res = await request(app)
      .get('/api/admin/levels')
      .set('Authorization', STUDENT_TOKEN);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('403 FORBIDDEN — DELETE /api/admin/levels/1 with student token', async () => {
    const res = await request(app)
      .delete('/api/admin/levels/1')
      .set('Authorization', STUDENT_TOKEN);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('403 FORBIDDEN — DELETE /api/admin/categories/1 with student token', async () => {
    const res = await request(app)
      .delete('/api/admin/categories/1')
      .set('Authorization', STUDENT_TOKEN);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('403 FORBIDDEN — DELETE /api/admin/exercises/some-uuid with student token', async () => {
    const res = await request(app)
      .delete('/api/admin/exercises/some-uuid')
      .set('Authorization', STUDENT_TOKEN);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

// ---------------------------------------------------------------------------
// Security / Auth tests — Requirement 14.3: Admin token on student-only route → 403
// ---------------------------------------------------------------------------

describe('Auth — admin token accessing student-only route (Requirement 14.3)', () => {
  it('403 FORBIDDEN — POST /api/attempts with admin token', async () => {
    const res = await request(app)
      .post('/api/attempts')
      .set('Authorization', ADMIN_TOKEN)
      .send({ exercise_id: 'ex-1', query_sent: 'SELECT 1;', resolution_time_ms: 100 });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('403 FORBIDDEN — GET /api/attempts with admin token', async () => {
    const res = await request(app)
      .get('/api/attempts')
      .set('Authorization', ADMIN_TOKEN);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

// ---------------------------------------------------------------------------
// Business constraints — Requirement 11.4: Level with exercises → delete rejected
// ---------------------------------------------------------------------------

describe('DELETE /api/admin/levels/:id — Requirement 11.4', () => {
  it('422 HAS_ASSOCIATED_EXERCISES — level still has exercises', async () => {
    (mockAdminUseCase.deleteLevel as jest.Mock).mockRejectedValue({
      code: 'HAS_ASSOCIATED_EXERCISES',
      message: 'Cannot delete level: it still has associated exercises.',
    });

    const res = await request(app)
      .delete('/api/admin/levels/1')
      .set('Authorization', ADMIN_TOKEN);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('HAS_ASSOCIATED_EXERCISES');
  });
});

// ---------------------------------------------------------------------------
// Business constraints — Requirement 12.4: Category with exercises → delete rejected
// ---------------------------------------------------------------------------

describe('DELETE /api/admin/categories/:id — Requirement 12.4', () => {
  it('422 HAS_ASSOCIATED_EXERCISES — category still has exercises', async () => {
    (mockAdminUseCase.deleteCategory as jest.Mock).mockRejectedValue({
      code: 'HAS_ASSOCIATED_EXERCISES',
      message: 'Cannot delete category: it still has associated exercises.',
    });

    const res = await request(app)
      .delete('/api/admin/categories/1')
      .set('Authorization', ADMIN_TOKEN);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('HAS_ASSOCIATED_EXERCISES');
  });
});

// ---------------------------------------------------------------------------
// Business constraints — Requirement 13.4: Exercise with attempts → delete rejected
// ---------------------------------------------------------------------------

describe('DELETE /api/admin/exercises/:id — Requirement 13.4', () => {
  it('422 HAS_ASSOCIATED_ATTEMPTS — exercise still has recorded attempts', async () => {
    (mockAdminUseCase.deleteExercise as jest.Mock).mockRejectedValue({
      code: 'HAS_ASSOCIATED_ATTEMPTS',
      message: 'Cannot delete exercise: it still has recorded attempts.',
    });

    const res = await request(app)
      .delete('/api/admin/exercises/exercise-uuid-001')
      .set('Authorization', ADMIN_TOKEN);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('HAS_ASSOCIATED_ATTEMPTS');
  });
});
