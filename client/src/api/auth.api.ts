import { AuthResponse } from '../types';
import { apiClient } from './client';

/**
 * Register a new user account.
 * POST /auth/register
 */
export async function register(
  username: string,
  email: string,
  password: string,
): Promise<{ message: string }> {
  const { data } = await apiClient.post<{ message: string }>('/auth/register', {
    username,
    email,
    password,
  });
  return data;
}

/**
 * Authenticate with email + password and receive a JWT.
 * POST /auth/login
 */
export async function login(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/login', {
    email,
    password,
  });
  return data;
}
