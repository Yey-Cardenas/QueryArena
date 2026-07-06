/**
 * Unit tests for UserUseCase
 * All ports are mocked with jest.fn() — no real database.
 *
 * Requirements covered: 3.1, 3.3, 3.4, 3.6
 */

import { UserUseCase } from '../../src/domain/use-cases/UserUseCase';
import type { IUserRepository } from '../../src/domain/ports/out/IUserRepository';
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
    created_at: new Date('2024-01-01T00:00:00.000Z'),
    updated_at: new Date('2024-01-01T00:00:00.000Z'),
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

  const useCase = new UserUseCase(userRepository);

  return { useCase, userRepository };
}

// ---------------------------------------------------------------------------
// getProfile()
// ---------------------------------------------------------------------------

describe('UserUseCase.getProfile()', () => {
  it('1. success — existing userId → returns complete profile: username, email, created_at, role (Req 3.1)', async () => {
    const { useCase, userRepository } = makeMocks();
    const user = makeUser();

    userRepository.findById.mockResolvedValue(user);

    const result = await useCase.getProfile('user-id-1');

    expect(result).toEqual({
      username: user.username,
      email: user.email,
      created_at: user.created_at,
      role: user.role,
    });
    // sensitive field must NOT be exposed
    expect(result).not.toHaveProperty('password_hash');
    expect(result).not.toHaveProperty('is_active');
  });

  it('2. user not found — findById returns null → throws USER_NOT_FOUND', async () => {
    const { useCase, userRepository } = makeMocks();

    userRepository.findById.mockResolvedValue(null);

    await expect(useCase.getProfile('non-existent-id')).rejects.toMatchObject({
      code: 'USER_NOT_FOUND',
    });
  });
});

// ---------------------------------------------------------------------------
// updateProfile()
// ---------------------------------------------------------------------------

describe('UserUseCase.updateProfile()', () => {
  // --- Req 3.3: duplicate username from a different user ---

  it('3. username duplicate from different user — findByUsername returns another user → throws USERNAME_TAKEN (Req 3.3)', async () => {
    const { useCase, userRepository } = makeMocks();

    // The logged-in user has id 'user-id-1'
    // findByUsername returns a DIFFERENT user ('user-id-2') who already owns that username
    userRepository.findByUsername.mockResolvedValue(
      makeUser({ id: 'user-id-2', username: 'takenuser' }),
    );

    await expect(
      useCase.updateProfile('user-id-1', { username: 'takenuser' }),
    ).rejects.toMatchObject({ code: 'USERNAME_TAKEN', field: 'username' });

    expect(userRepository.update).not.toHaveBeenCalled();
  });

  it('4. username same as own — findByUsername returns the same user → succeeds (no conflict)', async () => {
    const { useCase, userRepository } = makeMocks();
    const user = makeUser({ id: 'user-id-1', username: 'testuser' });

    userRepository.findByUsername.mockResolvedValue(user); // same user
    userRepository.update.mockResolvedValue(user);

    const result = await useCase.updateProfile('user-id-1', { username: 'testuser' });

    expect(result).toMatchObject({ username: 'testuser' });
    expect(userRepository.update).toHaveBeenCalledTimes(1);
  });

  // --- Req 3.4: duplicate email from a different user ---

  it('5. email duplicate from different user — findByEmail returns another user → throws EMAIL_TAKEN (Req 3.4)', async () => {
    const { useCase, userRepository } = makeMocks();

    userRepository.findByEmail.mockResolvedValue(
      makeUser({ id: 'user-id-2', email: 'taken@example.com' }),
    );

    await expect(
      useCase.updateProfile('user-id-1', { email: 'taken@example.com' }),
    ).rejects.toMatchObject({ code: 'EMAIL_TAKEN', field: 'email' });

    expect(userRepository.update).not.toHaveBeenCalled();
  });

  it('6. email same as own — findByEmail returns the same user → succeeds (no conflict)', async () => {
    const { useCase, userRepository } = makeMocks();
    const user = makeUser({ id: 'user-id-1', email: 'test@example.com' });

    userRepository.findByEmail.mockResolvedValue(user); // same user
    userRepository.update.mockResolvedValue(user);

    const result = await useCase.updateProfile('user-id-1', { email: 'test@example.com' });

    expect(result).toMatchObject({ email: 'test@example.com' });
    expect(userRepository.update).toHaveBeenCalledTimes(1);
  });

  // --- Req 3.6: empty fields must be rejected ---

  it('7. empty username → throws VALIDATION_ERROR with field "username" (Req 3.6)', async () => {
    const { useCase, userRepository } = makeMocks();

    await expect(
      useCase.updateProfile('user-id-1', { username: '' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', field: 'username' });

    expect(userRepository.findByUsername).not.toHaveBeenCalled();
    expect(userRepository.update).not.toHaveBeenCalled();
  });

  it('8. whitespace-only username → throws VALIDATION_ERROR with field "username" (Req 3.6)', async () => {
    const { useCase, userRepository } = makeMocks();

    await expect(
      useCase.updateProfile('user-id-1', { username: '   ' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', field: 'username' });

    expect(userRepository.update).not.toHaveBeenCalled();
  });

  it('9. empty email → throws VALIDATION_ERROR with field "email" (Req 3.6)', async () => {
    const { useCase, userRepository } = makeMocks();

    await expect(
      useCase.updateProfile('user-id-1', { email: '' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', field: 'email' });

    expect(userRepository.findByEmail).not.toHaveBeenCalled();
    expect(userRepository.update).not.toHaveBeenCalled();
  });

  it('10. whitespace-only email → throws VALIDATION_ERROR with field "email" (Req 3.6)', async () => {
    const { useCase, userRepository } = makeMocks();

    await expect(
      useCase.updateProfile('user-id-1', { email: '   ' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', field: 'email' });

    expect(userRepository.update).not.toHaveBeenCalled();
  });

  // --- Happy path: valid update ---

  it('11. valid username update — no conflict → calls update and returns updated profile', async () => {
    const { useCase, userRepository } = makeMocks();
    const updated = makeUser({ id: 'user-id-1', username: 'newname' });

    userRepository.findByUsername.mockResolvedValue(null); // no conflict
    userRepository.update.mockResolvedValue(updated);

    const result = await useCase.updateProfile('user-id-1', { username: 'newname' });

    expect(userRepository.update).toHaveBeenCalledWith('user-id-1', { username: 'newname' });
    expect(result).toEqual({
      username: updated.username,
      email: updated.email,
      created_at: updated.created_at,
      role: updated.role,
    });
  });

  it('12. valid email update — no conflict → calls update and returns updated profile', async () => {
    const { useCase, userRepository } = makeMocks();
    const updated = makeUser({ id: 'user-id-1', email: 'new@example.com' });

    userRepository.findByEmail.mockResolvedValue(null); // no conflict
    userRepository.update.mockResolvedValue(updated);

    const result = await useCase.updateProfile('user-id-1', { email: 'new@example.com' });

    expect(userRepository.update).toHaveBeenCalledWith('user-id-1', { email: 'new@example.com' });
    expect(result).toMatchObject({ email: 'new@example.com' });
  });
});

// ---------------------------------------------------------------------------
// Property-Based Tests
// ---------------------------------------------------------------------------

import * as fc from 'fast-check';

describe('UserUseCase — Property-Based Tests', () => {
  // Feature: query-arena, Property 7
  // Validates: Requirements 3.1
  it('Property 7: Perfil devuelto es completo y consistente', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          id: fc.uuid(),
          username: fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
          email: fc.emailAddress(),
          role: fc.constantFrom('student', 'admin') as fc.Arbitrary<'student' | 'admin'>,
        }),
        async (arbitraryUser) => {
          const { useCase, userRepository } = makeMocks();

          const user = makeUser({
            id: arbitraryUser.id,
            username: arbitraryUser.username,
            email: arbitraryUser.email,
            role: arbitraryUser.role,
          });

          userRepository.findById.mockResolvedValue(user);

          const result = await useCase.getProfile(arbitraryUser.id);

          // Must contain exactly the expected fields with matching values
          expect(result).toEqual({
            username: user.username,
            email: user.email,
            created_at: user.created_at,
            role: user.role,
          });

          // Sensitive fields must NOT be exposed
          expect(result).not.toHaveProperty('password_hash');
          expect(result).not.toHaveProperty('is_active');
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: query-arena, Property 8
  // Validates: Requirements 3.3, 3.4
  it('Property 8a: Actualización de perfil respeta unicidad — username conflict', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
        async (userIdA, userIdB, username) => {
          fc.pre(userIdA !== userIdB);

          const { useCase, userRepository } = makeMocks();

          // The username belongs to a different user (userIdB)
          userRepository.findByUsername.mockResolvedValue(
            makeUser({ id: userIdB, username }),
          );

          await expect(
            useCase.updateProfile(userIdA, { username }),
          ).rejects.toMatchObject({ code: 'USERNAME_TAKEN' });

          expect(userRepository.update).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: query-arena, Property 8
  // Validates: Requirements 3.3, 3.4
  it('Property 8b: Actualización de perfil respeta unicidad — email conflict', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.emailAddress(),
        async (userIdA, userIdB, email) => {
          fc.pre(userIdA !== userIdB);

          const { useCase, userRepository } = makeMocks();

          // The email belongs to a different user (userIdB)
          userRepository.findByEmail.mockResolvedValue(
            makeUser({ id: userIdB, email }),
          );

          await expect(
            useCase.updateProfile(userIdA, { email }),
          ).rejects.toMatchObject({ code: 'EMAIL_TAKEN' });

          expect(userRepository.update).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 100 },
    );
  });
});
