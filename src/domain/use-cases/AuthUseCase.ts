/**
 * AuthUseCase — application service for user registration and login.
 *
 * Pure domain logic: no framework imports, no infrastructure dependencies.
 * All I/O is delegated to injected output ports.
 */

import type { IAuthUseCase } from '../ports/in/IAuthUseCase';
import type { IUserRepository } from '../ports/out/IUserRepository';
import type { IHashPort } from '../ports/out/IHashPort';
import type { ITokenPort } from '../ports/out/ITokenPort';

// ---------------------------------------------------------------------------
// Domain error types
// ---------------------------------------------------------------------------

export interface DomainError {
  code:
    | 'VALIDATION_ERROR'
    | 'PASSWORD_TOO_SHORT'
    | 'USERNAME_TAKEN'
    | 'EMAIL_TAKEN'
    | 'INVALID_CREDENTIALS';
  message: string;
  field?: string;
}

/** Throw helper — returns a typed DomainError wrapped in a plain Error-like object */
function domainError(err: DomainError): DomainError {
  return err;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateRegisterInputs(
  username: string,
  email: string,
  password: string,
): void {
  if (!username || username.trim().length === 0) {
    throw domainError({
      code: 'VALIDATION_ERROR',
      message: 'Username is required.',
      field: 'username',
    });
  }

  if (!email || !EMAIL_REGEX.test(email)) {
    throw domainError({
      code: 'VALIDATION_ERROR',
      message: 'A valid email address is required.',
      field: 'email',
    });
  }

  if (!password || password.length < 8) {
    throw domainError({
      code: 'PASSWORD_TOO_SHORT',
      message: 'Password must be at least 8 characters long.',
    });
  }
}

function validateLoginInputs(email: string, password: string): void {
  if (!email || email.trim().length === 0) {
    throw domainError({
      code: 'VALIDATION_ERROR',
      message: 'Email is required.',
      field: 'email',
    });
  }

  if (!password || password.trim().length === 0) {
    throw domainError({
      code: 'VALIDATION_ERROR',
      message: 'Password is required.',
      field: 'password',
    });
  }
}

// ---------------------------------------------------------------------------
// AuthUseCase
// ---------------------------------------------------------------------------

export class AuthUseCase implements IAuthUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly hashPort: IHashPort,
    private readonly tokenPort: ITokenPort,
  ) {}

  // -------------------------------------------------------------------------
  // register
  // -------------------------------------------------------------------------

  async register(
    username: string,
    email: string,
    password: string,
  ): Promise<{ message: string }> {
    // 1. Validate inputs
    validateRegisterInputs(username, email, password);

    // 2. Check username uniqueness
    const existingByUsername = await this.userRepository.findByUsername(username);
    if (existingByUsername !== null) {
      throw domainError({
        code: 'USERNAME_TAKEN',
        message: 'That username is already in use.',
        field: 'username',
      });
    }

    // 3. Check email uniqueness
    const existingByEmail = await this.userRepository.findByEmail(email);
    if (existingByEmail !== null) {
      throw domainError({
        code: 'EMAIL_TAKEN',
        message: 'That email address is already registered.',
        field: 'email',
      });
    }

    // 4. Hash password — propagate any hashing error as-is
    const password_hash = await this.hashPort.hash(password);

    // 5. Persist new user with role 'student'
    await this.userRepository.create({
      username,
      email,
      password_hash,
      role: 'student',
    });

    return { message: 'User registered successfully.' };
  }

  // -------------------------------------------------------------------------
  // login
  // -------------------------------------------------------------------------

  async login(
    email: string,
    password: string,
  ): Promise<{
    token: string;
    user: { id: string; username: string; role: 'student' | 'admin' };
  }> {
    // 1. Validate inputs
    validateLoginInputs(email, password);

    // 2. Look up user — use generic error to avoid user-enumeration attacks
    const user = await this.userRepository.findByEmail(email);
    if (user === null) {
      throw domainError({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      });
    }

    // 3. Compare password hash
    const passwordMatches = await this.hashPort.compare(password, user.password_hash);
    if (!passwordMatches) {
      throw domainError({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      });
    }

    // 4. Issue JWT — payload includes userId, role (and exp is set by the port impl)
    const token = this.tokenPort.sign({ userId: user.id, role: user.role });

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    };
  }
}
