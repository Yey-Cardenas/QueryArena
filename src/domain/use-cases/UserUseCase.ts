/**
 * UserUseCase — application service for user profile management.
 *
 * Pure domain logic: no framework imports, no infrastructure dependencies.
 * All I/O is delegated to injected output ports.
 */

import type { IUserUseCase, UserProfileDto } from '../ports/in/IUserUseCase';
import type { IUserRepository } from '../ports/out/IUserRepository';

// ---------------------------------------------------------------------------
// Domain error types
// ---------------------------------------------------------------------------

export interface DomainError {
  code:
    | 'USER_NOT_FOUND'
    | 'USERNAME_TAKEN'
    | 'EMAIL_TAKEN'
    | 'VALIDATION_ERROR';
  message: string;
  field?: string;
}

/** Throw helper — returns a typed DomainError wrapped in a plain Error-like object */
function domainError(err: DomainError): DomainError {
  return err;
}

// ---------------------------------------------------------------------------
// UserUseCase
// ---------------------------------------------------------------------------

export class UserUseCase implements IUserUseCase {
  constructor(private readonly userRepository: IUserRepository) {}

  // -------------------------------------------------------------------------
  // getProfile
  // -------------------------------------------------------------------------

  async getProfile(userId: string): Promise<UserProfileDto> {
    const user = await this.userRepository.findById(userId);

    if (user === null) {
      throw domainError({
        code: 'USER_NOT_FOUND',
        message: 'User not found.',
      });
    }

    return {
      username: user.username,
      email: user.email,
      created_at: user.created_at,
      role: user.role,
    };
  }

  // -------------------------------------------------------------------------
  // updateProfile
  // -------------------------------------------------------------------------

  async updateProfile(
    userId: string,
    data: { username?: string; email?: string },
  ): Promise<UserProfileDto> {
    // 1. Validate fields are not empty strings if provided
    if (data.username !== undefined && data.username.trim().length === 0) {
      throw domainError({
        code: 'VALIDATION_ERROR',
        message: 'Username cannot be empty.',
        field: 'username',
      });
    }

    if (data.email !== undefined && data.email.trim().length === 0) {
      throw domainError({
        code: 'VALIDATION_ERROR',
        message: 'Email cannot be empty.',
        field: 'email',
      });
    }

    // 2. Check username uniqueness against other users
    if (data.username !== undefined) {
      const existingByUsername = await this.userRepository.findByUsername(data.username);
      if (existingByUsername !== null && existingByUsername.id !== userId) {
        throw domainError({
          code: 'USERNAME_TAKEN',
          message: 'That username is already in use.',
          field: 'username',
        });
      }
    }

    // 3. Check email uniqueness against other users
    if (data.email !== undefined) {
      const existingByEmail = await this.userRepository.findByEmail(data.email);
      if (existingByEmail !== null && existingByEmail.id !== userId) {
        throw domainError({
          code: 'EMAIL_TAKEN',
          message: 'That email address is already in use.',
          field: 'email',
        });
      }
    }

    // 4. Persist the update
    const updated = await this.userRepository.update(userId, {
      ...(data.username !== undefined && { username: data.username }),
      ...(data.email !== undefined && { email: data.email }),
    });

    return {
      username: updated.username,
      email: updated.email,
      created_at: updated.created_at,
      role: updated.role,
    };
  }
}
