/**
 * IAuthUseCase — Driving port for authentication.
 * Controllers depend on this interface, never on the concrete implementation.
 * No external dependencies — pure TypeScript types only.
 */

export interface IAuthUseCase {
  /**
   * Registers a new user with role 'student'.
   * Throws if username/email is already taken or if validation fails.
   */
  register(
    username: string,
    email: string,
    password: string,
  ): Promise<{ message: string }>;

  /**
   * Authenticates a user and returns a signed JWT along with basic user data.
   * Throws if credentials are invalid or the account is inactive.
   */
  login(
    email: string,
    password: string,
  ): Promise<{
    token: string;
    user: {
      id: string;
      username: string;
      role: 'student' | 'admin';
    };
  }>;
}
