import { apiClient } from './client';
import { User } from '../types';

// ─── Response shape from GET /api/users/me ───────────────────────────────────

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  role: 'student' | 'admin';
  created_at: string; // ISO 8601 date string from backend
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Maps the backend profile response to the frontend User type. */
export function mapProfile(p: UserProfile): User {
  return {
    id: p.id,
    username: p.username,
    email: p.email,
    role: p.role,
    createdAt: p.created_at,
  };
}

// ─── API calls ───────────────────────────────────────────────────────────────

/**
 * Fetch the authenticated user's profile.
 * GET /api/users/me
 */
export async function getProfile(): Promise<User> {
  const { data } = await apiClient.get<UserProfile>('/users/me');
  return mapProfile(data);
}

/**
 * Update allowed profile fields for the authenticated user.
 * PATCH /api/users/me
 */
export async function updateProfile(fields: {
  username?: string;
  email?: string;
}): Promise<User> {
  const { data } = await apiClient.patch<UserProfile>('/users/me', fields);
  return mapProfile(data);
}
