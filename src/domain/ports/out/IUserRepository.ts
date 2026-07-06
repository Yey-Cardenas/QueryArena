/**
 * Output port — IUserRepository
 * Contract the domain requires from the user persistence adapter.
 * No external dependencies — imports only from domain entities.
 */

import type { User, UserRole } from '../../entities/User';

export interface IUserRepository {
  /**
   * Find a user by their email address.
   * Returns null when no user with that email exists.
   */
  findByEmail(email: string): Promise<User | null>;

  /**
   * Find a user by their username.
   * Returns null when no user with that username exists.
   */
  findByUsername(username: string): Promise<User | null>;

  /**
   * Find a user by their unique identifier.
   * Returns null when no user with that id exists.
   */
  findById(id: string): Promise<User | null>;

  /**
   * Persist a new user and return the created entity.
   */
  create(data: {
    username: string;
    email: string;
    password_hash: string;
    role: UserRole;
  }): Promise<User>;

  /**
   * Update the mutable profile fields of an existing user.
   * Returns the updated entity.
   */
  update(
    id: string,
    data: { username?: string; email?: string },
  ): Promise<User>;
}
