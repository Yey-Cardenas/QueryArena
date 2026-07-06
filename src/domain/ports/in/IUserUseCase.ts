/**
 * IUserUseCase — Driving port for user profile management.
 * Controllers depend on this interface, never on the concrete implementation.
 * No external dependencies — pure TypeScript types only.
 */

import type { UserRole } from '../../entities/User';

export interface UserProfileDto {
  username: string;
  email: string;
  created_at: Date;
  role: UserRole;
}

export interface IUserUseCase {
  /**
   * Returns the profile data for the given user.
   * Throws if the user does not exist.
   */
  getProfile(userId: string): Promise<UserProfileDto>;

  /**
   * Updates allowed profile fields (username and/or email).
   * Throws if the new username or email conflicts with another user.
   */
  updateProfile(
    userId: string,
    data: { username?: string; email?: string },
  ): Promise<UserProfileDto>;
}
