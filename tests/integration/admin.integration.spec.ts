/**
 * Integration tests — Admin CRUD endpoints
 *
 * Covers all 12 admin routes:
 *   Levels:      POST/GET/PATCH/DELETE /api/admin/levels
 *   Categories:  POST/GET/PATCH/DELETE /api/admin/categories
 *   Exercises:   POST/GET/PATCH/DELETE /api/admin/exercises
 *
 * Each route is tested for:
 *   - Happy path (200/201/204 with correct payload)
 *   - Auth: no token → 401, student token → 403
 *   - Domain errors mapped to correct HTTP status
 *   - Unexpected errors → 500
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
import type { IAdminUseCase, CreateExerciseDto } from '../../src/domain/ports/in/IAdminUseCase';
import type { Level, Category, Exercise } from '../../src/domain/entities/Exercise';

const mockAdminUseCase: jest.Mocked<IAdminUseCase> = {
  listLevels:        jest.fn(),
  createLevel:       jest.fn(),
  updateLevel:       jest.fn(),
  deleteLevel:       jest.fn(),
  listCategories:    jest.fn(),
  createCategory:    jest.fn(),
  updateCategory:    jest.fn(),
  deleteCategory:    jest.fn(),
  listExercisesAdmin: jest.fn(),
  createExercise:    jest.fn(),
  updateExercise:    jest.fn(),
  deleteExercise:    jest.fn(),
};

jest.mock('../../src/infrastructure/container', () => ({
  container: {
    authUseCase:     { register: jest.fn(), login: jest.fn() },
    userUseCase:     { getProfile: jest.fn(), updateProfile: jest.fn() },
    exerciseUseCase: { listExercises: jest.fn(), getExerciseById: jest.fn() },
    attemptUseCase:  { submitAttempt: jest.fn(), getAttemptHistory: jest.fn() },
    rankingUseCase:  { getRanking: jest.fn(), updateScore: jest.fn() },
    dashboardUseCase: {
      getSummary: jest.fn(), getProgressByLevel: jest.fn(),
      getProgressByCategory: jest.fn(), getRecentHistory: jest.fn(),
    },
    adminUseCase: mockAdminUseCase,
  },
}));

// ---------------------------------------------------------------------------
// Import app + supertest AFTER mocks
// ---------------------------------------------------------------------------
import request from 'supertest';
import { app } from '../../src/app';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const ADMIN_TOKEN   = 'Bearer valid-admin-token';
const STUDENT_TOKEN = 'Bearer valid-student-token';
const ADMIN_UUID    = 'admin-uuid-001';

const sampleLevel: Level = {
  id: 1, name: 'Básico', created_at: new Date('2024-01-01T00:00:00.000Z'),
};
const sampleCategory: Category = {
  id: 1, name: 'SELECT', created_at: new Date('2024-01-01T00:00:00.000Z'),
};
const sampleExercise: Exercise = {
  id: 'ex-uuid-1', title: 'Select all users',
  description: 'Write a query to select all users.',
  expected_solution: 'SELECT * FROM users', score: 10,
  is_active: true, level_id: 1, category_id: 1,
  created_at: new Date('2024-01-01T00:00:00.000Z'),
  updated_at: new Date('2024-01-01T00:00:00.000Z'),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockVerify.mockImplementation((token: string) => {
    if (token === 'valid-admin-token')
      return { userId: ADMIN_UUID, role: 'admin' as UserRole, exp: 9999999999 };
    if (token === 'valid-student-token')
      return { userId: 'student-uuid', role: 'student' as UserRole, exp: 9999999999 };
    const { InvalidTokenError } = jest.requireActual(
      '../../src/adapters/out/security/JWTAdapter',
    ) as typeof import('../../src/adapters/out/security/JWTAdapter');
    throw new InvalidTokenError('Invalid token');
  });
});

// ===========================================================================
// LEVELS
// ===========================================================================

describe('GET /api/admin/levels', () => {
  it('200 — admin → returns level list', async () => {
    mockAdminUseCase.listLevels.mockResolvedValue([sampleLevel]);
    const res = await request(app).get('/api/admin/levels').set('Authorization', ADMIN_TOKEN);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ id: 1, name: 'Básico' });
    expect(mockAdminUseCase.listLevels).toHaveBeenCalledTimes(1);
  });

  it('200 — empty list', async () => {
    mockAdminUseCase.listLevels.mockResolvedValue([]);
    const res = await request(app).get('/api/admin/levels').set('Authorization', ADMIN_TOKEN);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('401 — no token', async () => {
    const res = await request(app).get('/api/admin/levels');
    expect(res.status).toBe(401);
    expect(mockAdminUseCase.listLevels).not.toHaveBeenCalled();
  });

  it('403 — student token', async () => {
    const res = await request(app).get('/api/admin/levels').set('Authorization', STUDENT_TOKEN);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

describe('POST /api/admin/levels', () => {
  it('201 — valid name → returns created level', async () => {
    mockAdminUseCase.createLevel.mockResolvedValue(sampleLevel);
    const res = await request(app)
      .post('/api/admin/levels').set('Authorization', ADMIN_TOKEN)
      .send({ name: 'Básico' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 1, name: 'Básico' });
    expect(mockAdminUseCase.createLevel).toHaveBeenCalledWith('Básico');
  });

  it('409 — duplicate name → 409 NAME_ALREADY_EXISTS', async () => {
    mockAdminUseCase.createLevel.mockRejectedValue({
      code: 'NAME_ALREADY_EXISTS', message: 'A level named "Básico" already exists.', field: 'name',
    });
    const res = await request(app)
      .post('/api/admin/levels').set('Authorization', ADMIN_TOKEN)
      .send({ name: 'Básico' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NAME_ALREADY_EXISTS');
  });

  it('422 — empty name → 422 VALIDATION_ERROR', async () => {
    mockAdminUseCase.createLevel.mockRejectedValue({
      code: 'VALIDATION_ERROR', message: 'Level name is required.', field: 'name',
    });
    const res = await request(app)
      .post('/api/admin/levels').set('Authorization', ADMIN_TOKEN)
      .send({ name: '' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('401 — no token', async () => {
    const res = await request(app).post('/api/admin/levels').send({ name: 'X' });
    expect(res.status).toBe(401);
  });

  it('403 — student token', async () => {
    const res = await request(app)
      .post('/api/admin/levels').set('Authorization', STUDENT_TOKEN).send({ name: 'X' });
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/admin/levels/:id', () => {
  it('200 — valid rename → returns updated level', async () => {
    const updated = { ...sampleLevel, name: 'Avanzado' };
    mockAdminUseCase.updateLevel.mockResolvedValue(updated);
    const res = await request(app)
      .patch('/api/admin/levels/1').set('Authorization', ADMIN_TOKEN)
      .send({ name: 'Avanzado' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Avanzado');
    expect(mockAdminUseCase.updateLevel).toHaveBeenCalledWith(1, 'Avanzado');
  });

  it('404 — level not found → 404 NOT_FOUND', async () => {
    mockAdminUseCase.updateLevel.mockRejectedValue({
      code: 'NOT_FOUND', message: 'Level with id 999 not found.',
    });
    const res = await request(app)
      .patch('/api/admin/levels/999').set('Authorization', ADMIN_TOKEN)
      .send({ name: 'X' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('409 — duplicate name → 409 NAME_ALREADY_EXISTS', async () => {
    mockAdminUseCase.updateLevel.mockRejectedValue({
      code: 'NAME_ALREADY_EXISTS', message: 'Already exists.', field: 'name',
    });
    const res = await request(app)
      .patch('/api/admin/levels/1').set('Authorization', ADMIN_TOKEN)
      .send({ name: 'Intermedio' });
    expect(res.status).toBe(409);
  });

  it('401 — no token', async () => {
    const res = await request(app).patch('/api/admin/levels/1').send({ name: 'X' });
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/admin/levels/:id', () => {
  it('204 — no exercises → deleted successfully', async () => {
    mockAdminUseCase.deleteLevel.mockResolvedValue(undefined);
    const res = await request(app)
      .delete('/api/admin/levels/1').set('Authorization', ADMIN_TOKEN);
    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
    expect(mockAdminUseCase.deleteLevel).toHaveBeenCalledWith(1);
  });

  it('422 — has exercises → 422 HAS_ASSOCIATED_EXERCISES', async () => {
    mockAdminUseCase.deleteLevel.mockRejectedValue({
      code: 'HAS_ASSOCIATED_EXERCISES', message: 'Level has exercises.',
    });
    const res = await request(app)
      .delete('/api/admin/levels/1').set('Authorization', ADMIN_TOKEN);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('HAS_ASSOCIATED_EXERCISES');
  });

  it('404 — level not found → 404 NOT_FOUND', async () => {
    mockAdminUseCase.deleteLevel.mockRejectedValue({
      code: 'NOT_FOUND', message: 'Level not found.',
    });
    const res = await request(app)
      .delete('/api/admin/levels/999').set('Authorization', ADMIN_TOKEN);
    expect(res.status).toBe(404);
  });

  it('401 — no token', async () => {
    const res = await request(app).delete('/api/admin/levels/1');
    expect(res.status).toBe(401);
  });

  it('403 — student token', async () => {
    const res = await request(app)
      .delete('/api/admin/levels/1').set('Authorization', STUDENT_TOKEN);
    expect(res.status).toBe(403);
  });
});

// ===========================================================================
// CATEGORIES
// ===========================================================================

describe('GET /api/admin/categories', () => {
  it('200 — admin → returns category list', async () => {
    mockAdminUseCase.listCategories.mockResolvedValue([sampleCategory]);
    const res = await request(app).get('/api/admin/categories').set('Authorization', ADMIN_TOKEN);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ id: 1, name: 'SELECT' });
  });

  it('401 — no token', async () => {
    const res = await request(app).get('/api/admin/categories');
    expect(res.status).toBe(401);
  });

  it('403 — student token', async () => {
    const res = await request(app).get('/api/admin/categories').set('Authorization', STUDENT_TOKEN);
    expect(res.status).toBe(403);
  });
});

describe('POST /api/admin/categories', () => {
  it('201 — valid name → returns created category', async () => {
    mockAdminUseCase.createCategory.mockResolvedValue(sampleCategory);
    const res = await request(app)
      .post('/api/admin/categories').set('Authorization', ADMIN_TOKEN)
      .send({ name: 'SELECT' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 1, name: 'SELECT' });
    expect(mockAdminUseCase.createCategory).toHaveBeenCalledWith('SELECT');
  });

  it('409 — duplicate name → 409 NAME_ALREADY_EXISTS', async () => {
    mockAdminUseCase.createCategory.mockRejectedValue({
      code: 'NAME_ALREADY_EXISTS', message: 'Already exists.', field: 'name',
    });
    const res = await request(app)
      .post('/api/admin/categories').set('Authorization', ADMIN_TOKEN)
      .send({ name: 'SELECT' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NAME_ALREADY_EXISTS');
  });

  it('422 — empty name → 422 VALIDATION_ERROR', async () => {
    mockAdminUseCase.createCategory.mockRejectedValue({
      code: 'VALIDATION_ERROR', message: 'Name required.', field: 'name',
    });
    const res = await request(app)
      .post('/api/admin/categories').set('Authorization', ADMIN_TOKEN)
      .send({ name: '' });
    expect(res.status).toBe(422);
  });

  it('401 — no token', async () => {
    const res = await request(app).post('/api/admin/categories').send({ name: 'X' });
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/admin/categories/:id', () => {
  it('200 — valid rename → returns updated category', async () => {
    const updated = { ...sampleCategory, name: 'JOIN' };
    mockAdminUseCase.updateCategory.mockResolvedValue(updated);
    const res = await request(app)
      .patch('/api/admin/categories/1').set('Authorization', ADMIN_TOKEN)
      .send({ name: 'JOIN' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('JOIN');
    expect(mockAdminUseCase.updateCategory).toHaveBeenCalledWith(1, 'JOIN');
  });

  it('404 — not found → 404 NOT_FOUND', async () => {
    mockAdminUseCase.updateCategory.mockRejectedValue({
      code: 'NOT_FOUND', message: 'Category not found.',
    });
    const res = await request(app)
      .patch('/api/admin/categories/999').set('Authorization', ADMIN_TOKEN)
      .send({ name: 'X' });
    expect(res.status).toBe(404);
  });

  it('401 — no token', async () => {
    const res = await request(app).patch('/api/admin/categories/1').send({ name: 'X' });
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/admin/categories/:id', () => {
  it('204 — no exercises → deleted', async () => {
    mockAdminUseCase.deleteCategory.mockResolvedValue(undefined);
    const res = await request(app)
      .delete('/api/admin/categories/1').set('Authorization', ADMIN_TOKEN);
    expect(res.status).toBe(204);
    expect(mockAdminUseCase.deleteCategory).toHaveBeenCalledWith(1);
  });

  it('422 — has exercises → 422 HAS_ASSOCIATED_EXERCISES', async () => {
    mockAdminUseCase.deleteCategory.mockRejectedValue({
      code: 'HAS_ASSOCIATED_EXERCISES', message: 'Category has exercises.',
    });
    const res = await request(app)
      .delete('/api/admin/categories/1').set('Authorization', ADMIN_TOKEN);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('HAS_ASSOCIATED_EXERCISES');
  });

  it('403 — student token', async () => {
    const res = await request(app)
      .delete('/api/admin/categories/1').set('Authorization', STUDENT_TOKEN);
    expect(res.status).toBe(403);
  });
});

// ===========================================================================
// EXERCISES
// ===========================================================================

const validExerciseDto: CreateExerciseDto = {
  title: 'Select all users',
  description: 'A basic select exercise.',
  enunciado: 'Write a query to select all users from the users table.',
  expected_solution: 'SELECT * FROM users',
  score: 10,
  level_id: 1,
  category_id: 1,
};

describe('GET /api/admin/exercises', () => {
  it('200 — admin → returns all exercises (including inactive)', async () => {
    const inactive = { ...sampleExercise, id: 'ex-2', is_active: false };
    mockAdminUseCase.listExercisesAdmin.mockResolvedValue([sampleExercise, inactive]);
    const res = await request(app).get('/api/admin/exercises').set('Authorization', ADMIN_TOKEN);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(mockAdminUseCase.listExercisesAdmin).toHaveBeenCalledTimes(1);
  });

  it('401 — no token', async () => {
    const res = await request(app).get('/api/admin/exercises');
    expect(res.status).toBe(401);
  });

  it('403 — student token', async () => {
    const res = await request(app).get('/api/admin/exercises').set('Authorization', STUDENT_TOKEN);
    expect(res.status).toBe(403);
  });
});

describe('POST /api/admin/exercises', () => {
  it('201 — valid dto → returns created exercise', async () => {
    mockAdminUseCase.createExercise.mockResolvedValue(sampleExercise);
    const res = await request(app)
      .post('/api/admin/exercises').set('Authorization', ADMIN_TOKEN)
      .send(validExerciseDto);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 'ex-uuid-1', title: 'Select all users' });
    expect(mockAdminUseCase.createExercise).toHaveBeenCalledWith(validExerciseDto);
  });

  it('422 — empty title → 422 VALIDATION_ERROR', async () => {
    mockAdminUseCase.createExercise.mockRejectedValue({
      code: 'VALIDATION_ERROR', message: 'Field "title" is required.', field: 'title',
    });
    const res = await request(app)
      .post('/api/admin/exercises').set('Authorization', ADMIN_TOKEN)
      .send({ ...validExerciseDto, title: '' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('422 — non-existent level_id → 422 INVALID_REFERENCE', async () => {
    mockAdminUseCase.createExercise.mockRejectedValue({
      code: 'INVALID_REFERENCE', message: 'Level 999 does not exist.', field: 'level_id',
    });
    const res = await request(app)
      .post('/api/admin/exercises').set('Authorization', ADMIN_TOKEN)
      .send({ ...validExerciseDto, level_id: 999 });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_REFERENCE');
  });

  it('422 — non-existent category_id → 422 INVALID_REFERENCE', async () => {
    mockAdminUseCase.createExercise.mockRejectedValue({
      code: 'INVALID_REFERENCE', message: 'Category 888 does not exist.', field: 'category_id',
    });
    const res = await request(app)
      .post('/api/admin/exercises').set('Authorization', ADMIN_TOKEN)
      .send({ ...validExerciseDto, category_id: 888 });
    expect(res.status).toBe(422);
  });

  it('401 — no token', async () => {
    const res = await request(app).post('/api/admin/exercises').send(validExerciseDto);
    expect(res.status).toBe(401);
  });

  it('403 — student token', async () => {
    const res = await request(app)
      .post('/api/admin/exercises').set('Authorization', STUDENT_TOKEN).send(validExerciseDto);
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/admin/exercises/:id', () => {
  it('200 — partial update → returns updated exercise', async () => {
    const updated = { ...sampleExercise, title: 'Updated title' };
    mockAdminUseCase.updateExercise.mockResolvedValue(updated);
    const res = await request(app)
      .patch('/api/admin/exercises/ex-uuid-1').set('Authorization', ADMIN_TOKEN)
      .send({ title: 'Updated title' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Updated title');
    expect(mockAdminUseCase.updateExercise).toHaveBeenCalledWith(
      'ex-uuid-1', { title: 'Updated title' },
    );
  });

  it('404 — exercise not found → 404 NOT_FOUND', async () => {
    mockAdminUseCase.updateExercise.mockRejectedValue({
      code: 'NOT_FOUND', message: 'Exercise not found.',
    });
    const res = await request(app)
      .patch('/api/admin/exercises/non-existent').set('Authorization', ADMIN_TOKEN)
      .send({ title: 'X' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('422 — invalid level_id reference → 422 INVALID_REFERENCE', async () => {
    mockAdminUseCase.updateExercise.mockRejectedValue({
      code: 'INVALID_REFERENCE', message: 'Level does not exist.', field: 'level_id',
    });
    const res = await request(app)
      .patch('/api/admin/exercises/ex-uuid-1').set('Authorization', ADMIN_TOKEN)
      .send({ level_id: 999 });
    expect(res.status).toBe(422);
  });

  it('500 — unexpected error → 500 INTERNAL_SERVER_ERROR', async () => {
    mockAdminUseCase.updateExercise.mockRejectedValue(new Error('DB crashed'));
    const res = await request(app)
      .patch('/api/admin/exercises/ex-uuid-1').set('Authorization', ADMIN_TOKEN)
      .send({ title: 'X' });
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
  });

  it('401 — no token', async () => {
    const res = await request(app).patch('/api/admin/exercises/ex-uuid-1').send({ title: 'X' });
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/admin/exercises/:id', () => {
  it('204 — no attempts → deleted successfully', async () => {
    mockAdminUseCase.deleteExercise.mockResolvedValue(undefined);
    const res = await request(app)
      .delete('/api/admin/exercises/ex-uuid-1').set('Authorization', ADMIN_TOKEN);
    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
    expect(mockAdminUseCase.deleteExercise).toHaveBeenCalledWith('ex-uuid-1');
  });

  it('422 — has attempts → 422 HAS_ASSOCIATED_ATTEMPTS', async () => {
    mockAdminUseCase.deleteExercise.mockRejectedValue({
      code: 'HAS_ASSOCIATED_ATTEMPTS', message: 'Exercise has attempts.',
    });
    const res = await request(app)
      .delete('/api/admin/exercises/ex-uuid-1').set('Authorization', ADMIN_TOKEN);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('HAS_ASSOCIATED_ATTEMPTS');
  });

  it('404 — exercise not found → 404 NOT_FOUND', async () => {
    mockAdminUseCase.deleteExercise.mockRejectedValue({
      code: 'NOT_FOUND', message: 'Exercise not found.',
    });
    const res = await request(app)
      .delete('/api/admin/exercises/non-existent').set('Authorization', ADMIN_TOKEN);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('500 — unexpected error → 500 INTERNAL_SERVER_ERROR', async () => {
    mockAdminUseCase.deleteExercise.mockRejectedValue(new Error('Unexpected'));
    const res = await request(app)
      .delete('/api/admin/exercises/ex-uuid-1').set('Authorization', ADMIN_TOKEN);
    expect(res.status).toBe(500);
  });

  it('401 — no token', async () => {
    const res = await request(app).delete('/api/admin/exercises/ex-uuid-1');
    expect(res.status).toBe(401);
  });

  it('403 — student token', async () => {
    const res = await request(app)
      .delete('/api/admin/exercises/ex-uuid-1').set('Authorization', STUDENT_TOKEN);
    expect(res.status).toBe(403);
  });
});
