/**
 * Integration tests — Auth endpoints
 *
 * Tests POST /api/auth/register and POST /api/auth/login end-to-end through
 * Express routes → controllers → use case (mocked) → error handler.
 *
 * Strategy: mock `infrastructure/container` so the Postgres adapters are
 * never instantiated, then import the app after the mock is in place.
 */

// ---------------------------------------------------------------------------
// Set required env vars BEFORE any module with env.ts is imported
// ---------------------------------------------------------------------------
process.env.DATABASE_URL  = 'postgres://test:test@localhost:5432/test';
process.env.JWT_SECRET    = 'test-secret-key-for-integration';
process.env.JWT_EXPIRES_IN = '1h';
process.env.BCRYPT_COST   = '10';

// ---------------------------------------------------------------------------
// Mock the DI container — must be done before importing app
// ---------------------------------------------------------------------------
import type { IAuthUseCase } from '../../src/domain/ports/in/IAuthUseCase';

const mockAuthUseCase: jest.Mocked<IAuthUseCase> = {
  register: jest.fn(),
  login: jest.fn(),
};

jest.mock('../../src/infrastructure/container', () => ({
  container: {
    authUseCase:      mockAuthUseCase,
    userUseCase:      { getProfile: jest.fn(), updateProfile: jest.fn() },
    exerciseUseCase:  { listExercises: jest.fn(), getExerciseById: jest.fn() },
    attemptUseCase:   { submitAttempt: jest.fn(), getAttemptHistory: jest.fn() },
    rankingUseCase:   { getRanking: jest.fn() },
    dashboardUseCase: {
      getSummary: jest.fn(),
      getProgressByLevel: jest.fn(),
      getProgressByCategory: jest.fn(),
      getRecentAttempts: jest.fn(),
    },
    adminUseCase: {
      getLevels: jest.fn(),
      createLevel: jest.fn(),
      updateLevel: jest.fn(),
      deleteLevel: jest.fn(),
      getCategories: jest.fn(),
      createCategory: jest.fn(),
      updateCategory: jest.fn(),
      deleteCategory: jest.fn(),
      getExercises: jest.fn(),
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

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// POST /api/auth/register
// ---------------------------------------------------------------------------

describe('POST /api/auth/register', () => {
  it('201 — valid credentials → use case called, returns message', async () => {
    mockAuthUseCase.register.mockResolvedValue({ message: 'User created successfully' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', email: 'alice@example.com', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ message: 'User created successfully' });
    expect(mockAuthUseCase.register).toHaveBeenCalledWith(
      'alice',
      'alice@example.com',
      'password123',
    );
  });

  it('409 — username already taken → error handler maps USERNAME_TAKEN to 409', async () => {
    mockAuthUseCase.register.mockRejectedValue({
      code: 'USERNAME_TAKEN',
      message: 'Username is already taken.',
    });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', email: 'alice@example.com', password: 'password123' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('USERNAME_TAKEN');
  });

  it('409 — email already registered → error handler maps EMAIL_TAKEN to 409', async () => {
    mockAuthUseCase.register.mockRejectedValue({
      code: 'EMAIL_TAKEN',
      message: 'Email is already registered.',
    });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'bob', email: 'alice@example.com', password: 'password123' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('422 — password too short → error handler maps VALIDATION_ERROR to 422', async () => {
    mockAuthUseCase.register.mockRejectedValue({
      code: 'VALIDATION_ERROR',
      message: 'Password must be at least 8 characters.',
      field: 'password',
    });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'carol', email: 'carol@example.com', password: 'short' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('422 — missing username → error handler maps VALIDATION_ERROR to 422', async () => {
    mockAuthUseCase.register.mockRejectedValue({
      code: 'VALIDATION_ERROR',
      message: 'username is required.',
      field: 'username',
    });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'carol@example.com', password: 'password123' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('500 — unexpected use case error → 500 with generic message', async () => {
    mockAuthUseCase.register.mockRejectedValue(new Error('Unexpected DB error'));

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'dave', email: 'dave@example.com', password: 'password123' });

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------

describe('POST /api/auth/login', () => {
  it('200 — valid credentials → returns token and user object', async () => {
    const loginResult = {
      token: 'jwt.token.here',
      user: { id: 'user-uuid', username: 'alice', role: 'student' as const },
    };
    mockAuthUseCase.login.mockResolvedValue(loginResult);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@example.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      token: 'jwt.token.here',
      user: { id: 'user-uuid', username: 'alice', role: 'student' },
    });
    expect(mockAuthUseCase.login).toHaveBeenCalledWith(
      'alice@example.com',
      'password123',
    );
  });

  it('401 — email not registered → 401 INVALID_CREDENTIALS', async () => {
    mockAuthUseCase.login.mockRejectedValue({
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password.',
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ghost@example.com', password: 'password123' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('401 — wrong password → 401 INVALID_CREDENTIALS, no token in body', async () => {
    mockAuthUseCase.login.mockRejectedValue({
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password.',
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@example.com', password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(res.body.token).toBeUndefined();
  });

  it('422 — missing email field → 422 VALIDATION_ERROR', async () => {
    mockAuthUseCase.login.mockRejectedValue({
      code: 'VALIDATION_ERROR',
      message: 'email is required.',
      field: 'email',
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ password: 'password123' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('422 — missing password field → 422 VALIDATION_ERROR', async () => {
    mockAuthUseCase.login.mockRejectedValue({
      code: 'VALIDATION_ERROR',
      message: 'password is required.',
      field: 'password',
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@example.com' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('500 — unexpected use case error → 500 INTERNAL_SERVER_ERROR', async () => {
    mockAuthUseCase.login.mockRejectedValue(new Error('DB connection failed'));

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@example.com', password: 'password123' });

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
  });
});
