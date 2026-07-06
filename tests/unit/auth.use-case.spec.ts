/**
 * Unit tests for AuthUseCase
 * All ports are mocked with jest.fn() — no real bcrypt, JWT, or database.
 */

import { AuthUseCase } from '../../src/domain/use-cases/AuthUseCase';
import type { IUserRepository } from '../../src/domain/ports/out/IUserRepository';
import type { IHashPort } from '../../src/domain/ports/out/IHashPort';
import type { ITokenPort } from '../../src/domain/ports/out/ITokenPort';
import type { User } from '../../src/domain/entities/User';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-id-1',
    username: 'testuser',
    email: 'test@example.com',
    password_hash: 'hashed_password',
    role: 'student',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function makeMocks() {
  const userRepository: jest.Mocked<IUserRepository> = {
    findByEmail: jest.fn(),
    findByUsername: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };

  const hashPort: jest.Mocked<IHashPort> = {
    hash: jest.fn(),
    compare: jest.fn(),
  };

  const tokenPort: jest.Mocked<ITokenPort> = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  const useCase = new AuthUseCase(userRepository, hashPort, tokenPort);

  return { useCase, userRepository, hashPort, tokenPort };
}

// ---------------------------------------------------------------------------
// register()
// ---------------------------------------------------------------------------

describe('AuthUseCase.register()', () => {
  it('1. success — valid inputs, user does not exist → returns { message }, hashes password, creates user with role student', async () => {
    const { useCase, userRepository, hashPort } = makeMocks();

    userRepository.findByUsername.mockResolvedValue(null);
    userRepository.findByEmail.mockResolvedValue(null);
    hashPort.hash.mockResolvedValue('hashed_pw');
    userRepository.create.mockResolvedValue(makeUser());

    const result = await useCase.register('alice', 'alice@example.com', 'password123');

    expect(result).toMatchObject({ message: expect.any(String) });
    expect(hashPort.hash).toHaveBeenCalledTimes(1);
    expect(hashPort.hash).toHaveBeenCalledWith('password123');
    expect(userRepository.create).toHaveBeenCalledTimes(1);
    expect(userRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'student' }),
    );
  });

  it('2. username duplicate — findByUsername returns existing user → throws USERNAME_TAKEN', async () => {
    const { useCase, userRepository } = makeMocks();

    userRepository.findByUsername.mockResolvedValue(makeUser());

    await expect(
      useCase.register('testuser', 'other@example.com', 'password123'),
    ).rejects.toMatchObject({ code: 'USERNAME_TAKEN' });
  });

  it('3. email duplicate — findByUsername null, findByEmail returns existing user → throws EMAIL_TAKEN', async () => {
    const { useCase, userRepository } = makeMocks();

    userRepository.findByUsername.mockResolvedValue(null);
    userRepository.findByEmail.mockResolvedValue(makeUser());

    await expect(
      useCase.register('newuser', 'test@example.com', 'password123'),
    ).rejects.toMatchObject({ code: 'EMAIL_TAKEN' });
  });

  it('4. hash failure — hashPort.hash rejects → error propagates, create is never called', async () => {
    const { useCase, userRepository, hashPort } = makeMocks();

    userRepository.findByUsername.mockResolvedValue(null);
    userRepository.findByEmail.mockResolvedValue(null);
    hashPort.hash.mockRejectedValue(new Error('bcrypt failure'));

    await expect(
      useCase.register('alice', 'alice@example.com', 'password123'),
    ).rejects.toThrow('bcrypt failure');

    expect(userRepository.create).not.toHaveBeenCalled();
  });

  it('5. empty username → throws VALIDATION_ERROR with field "username"', async () => {
    const { useCase } = makeMocks();

    await expect(
      useCase.register('', 'alice@example.com', 'password123'),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', field: 'username' });
  });

  it('6. invalid email format → throws VALIDATION_ERROR with field "email"', async () => {
    const { useCase } = makeMocks();

    await expect(
      useCase.register('alice', 'not-an-email', 'password123'),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', field: 'email' });
  });

  it('7. password too short (< 8 chars) → throws PASSWORD_TOO_SHORT', async () => {
    const { useCase } = makeMocks();

    await expect(
      useCase.register('alice', 'alice@example.com', 'short'),
    ).rejects.toMatchObject({ code: 'PASSWORD_TOO_SHORT' });
  });

  it('7b. password exactly 0 chars → throws PASSWORD_TOO_SHORT', async () => {
    const { useCase } = makeMocks();

    await expect(
      useCase.register('alice', 'alice@example.com', ''),
    ).rejects.toMatchObject({ code: 'PASSWORD_TOO_SHORT' });
  });
});

// ---------------------------------------------------------------------------
// login()
// ---------------------------------------------------------------------------

describe('AuthUseCase.login()', () => {
  it('8. success — user found, password matches → returns { token, user: { id, username, role } }', async () => {
    const { useCase, userRepository, hashPort, tokenPort } = makeMocks();
    const user = makeUser();

    userRepository.findByEmail.mockResolvedValue(user);
    hashPort.compare.mockResolvedValue(true);
    tokenPort.sign.mockReturnValue('jwt-token-abc');

    const result = await useCase.login('test@example.com', 'password123');

    expect(result).toMatchObject({
      token: 'jwt-token-abc',
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    });
  });

  it('9. email not registered — findByEmail returns null → throws INVALID_CREDENTIALS, tokenPort.sign not called', async () => {
    const { useCase, userRepository, tokenPort } = makeMocks();

    userRepository.findByEmail.mockResolvedValue(null);

    await expect(
      useCase.login('unknown@example.com', 'password123'),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });

    expect(tokenPort.sign).not.toHaveBeenCalled();
  });

  it('10. wrong password — user found but compare returns false → throws INVALID_CREDENTIALS, tokenPort.sign not called', async () => {
    const { useCase, userRepository, hashPort, tokenPort } = makeMocks();

    userRepository.findByEmail.mockResolvedValue(makeUser());
    hashPort.compare.mockResolvedValue(false);

    await expect(
      useCase.login('test@example.com', 'wrongpassword'),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });

    expect(tokenPort.sign).not.toHaveBeenCalled();
  });

  it('11. empty email → throws VALIDATION_ERROR with field "email"', async () => {
    const { useCase } = makeMocks();

    await expect(
      useCase.login('', 'password123'),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', field: 'email' });
  });

  it('12. empty password → throws VALIDATION_ERROR with field "password"', async () => {
    const { useCase } = makeMocks();

    await expect(
      useCase.login('test@example.com', ''),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', field: 'password' });
  });
});

// ---------------------------------------------------------------------------
// Property-Based Tests
// ---------------------------------------------------------------------------

import * as fc from 'fast-check';

describe('AuthUseCase — Property-Based Tests', () => {
  // Feature: query-arena, Property 1
  // Validates: Requirements 1.1, 1.5
  it('Property 1: Registro con datos válidos asigna rol student', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
        fc.emailAddress(),
        fc.string({ minLength: 8 }).filter((s) => s.trim().length > 0),
        async (username, email, password) => {
          const { useCase, userRepository, hashPort } = makeMocks();

          userRepository.findByUsername.mockResolvedValue(null);
          userRepository.findByEmail.mockResolvedValue(null);
          hashPort.hash.mockResolvedValue('hashed');
          userRepository.create.mockResolvedValue(makeUser({ username, email }));

          const result = await useCase.register(username, email, password);

          expect(result).toMatchObject({ message: expect.any(String) });
          expect(userRepository.create).toHaveBeenCalledWith(
            expect.objectContaining({ role: 'student' }),
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: query-arena, Property 2
  // Validates: Requirements 1.4
  it('Property 2: Password corta (0–7 chars) rechazada siempre', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
        fc.emailAddress(),
        fc.string({ maxLength: 7 }),
        async (username, email, password) => {
          const { useCase, userRepository } = makeMocks();

          userRepository.findByUsername.mockResolvedValue(null);
          userRepository.findByEmail.mockResolvedValue(null);

          await expect(
            useCase.register(username, email, password),
          ).rejects.toMatchObject({ code: 'PASSWORD_TOO_SHORT' });

          expect(userRepository.create).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: query-arena, Property 3
  // Validates: Requirements 1.6
  it('Property 3a: Username duplicado rechazado con USERNAME_TAKEN', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
        fc.emailAddress(),
        fc.string({ minLength: 8 }).filter((s) => s.trim().length > 0),
        async (username, email, password) => {
          const { useCase, userRepository } = makeMocks();

          userRepository.findByUsername.mockResolvedValue(makeUser({ username }));

          await expect(
            useCase.register(username, email, password),
          ).rejects.toMatchObject({ code: 'USERNAME_TAKEN' });

          expect(userRepository.create).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: query-arena, Property 3
  // Validates: Requirements 1.6
  it('Property 3b: Email duplicado rechazado con EMAIL_TAKEN', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
        fc.emailAddress(),
        fc.string({ minLength: 8 }).filter((s) => s.trim().length > 0),
        async (username, email, password) => {
          const { useCase, userRepository } = makeMocks();

          userRepository.findByUsername.mockResolvedValue(null);
          userRepository.findByEmail.mockResolvedValue(makeUser({ email }));

          await expect(
            useCase.register(username, email, password),
          ).rejects.toMatchObject({ code: 'EMAIL_TAKEN' });

          expect(userRepository.create).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: query-arena, Property 4
  // Validates: Requirements 1.8
  it('Property 4: Hash almacenado verificable — create recibe hash del port, no password plano', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
        fc.emailAddress(),
        fc.string({ minLength: 8 }).filter((s) => s.trim().length > 0),
        async (username, email, password) => {
          const { useCase, userRepository, hashPort } = makeMocks();
          const expectedHash = 'HASHED_' + password;

          userRepository.findByUsername.mockResolvedValue(null);
          userRepository.findByEmail.mockResolvedValue(null);
          hashPort.hash.mockResolvedValue(expectedHash);
          userRepository.create.mockResolvedValue(makeUser({ username, email, password_hash: expectedHash }));

          await useCase.register(username, email, password);

          expect(hashPort.hash).toHaveBeenCalledWith(password);
          expect(userRepository.create).toHaveBeenCalledWith(
            expect.objectContaining({ password_hash: expectedHash }),
          );
          const createCall = userRepository.create.mock.calls[0][0];
          expect(createCall.password_hash).not.toBe(password);
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: query-arena, Property 5
  // Validates: Requirements 2.1, 2.2, 2.3
  it('Property 5: Login exitoso produce JWT con claims correctas', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.emailAddress(),
        fc.string({ minLength: 8 }),
        async (userId, email, password) => {
          const { useCase, userRepository, hashPort, tokenPort } = makeMocks();
          const expectedToken = 'token-' + userId;
          const user = makeUser({ id: userId, email, role: 'student' });

          userRepository.findByEmail.mockResolvedValue(user);
          hashPort.compare.mockResolvedValue(true);
          tokenPort.sign.mockReturnValue(expectedToken);

          const result = await useCase.login(email, password);

          expect(result.token).toBe(expectedToken);
          expect(tokenPort.sign).toHaveBeenCalledWith({ userId, role: 'student' });
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: query-arena, Property 6
  // Validates: Requirements 2.6
  it('Property 6a: Email desconocido — nunca emite JWT', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.emailAddress(),
        fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
        async (email, password) => {
          const { useCase, userRepository, tokenPort } = makeMocks();

          userRepository.findByEmail.mockResolvedValue(null);

          await expect(
            useCase.login(email, password),
          ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });

          expect(tokenPort.sign).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: query-arena, Property 6
  // Validates: Requirements 2.6
  it('Property 6b: Password incorrecta — nunca emite JWT', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.emailAddress(),
        fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
        async (email, password) => {
          const { useCase, userRepository, hashPort, tokenPort } = makeMocks();

          userRepository.findByEmail.mockResolvedValue(makeUser({ email }));
          hashPort.compare.mockResolvedValue(false);

          await expect(
            useCase.login(email, password),
          ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });

          expect(tokenPort.sign).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 100 },
    );
  });
});
