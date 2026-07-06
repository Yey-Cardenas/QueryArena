/**
 * User domain entity.
 * No external dependencies — pure TypeScript types only.
 */

export type UserRole = 'student' | 'admin';

export interface User {
  id: string;           // UUID
  username: string;
  email: string;
  password_hash: string;
  role: UserRole;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}
