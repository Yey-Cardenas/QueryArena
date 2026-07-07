import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import * as authApi from '../api/auth.api';
import { User } from '../types';

// ─── Constants ───────────────────────────────────────────────────────────────

const TOKEN_KEY = 'qa_token';

// ─── JWT helpers (no library) ────────────────────────────────────────────────

interface JwtPayload {
  userId: string;
  role: 'student' | 'admin';
  exp: number;
  iat?: number;
}

/**
 * Decodes a JWT payload without verifying the signature.
 * Returns null if the token is malformed or expired.
 *
 * The backend (JWTAdapter.sign) embeds { userId, role } — not id/username.
 */
function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    // Base64url → Base64 → decode
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    const payload = JSON.parse(json) as JwtPayload;

    // Check expiry
    if (typeof payload.exp !== 'number') return null;
    if (Date.now() / 1000 > payload.exp) return null;

    return payload;
  } catch {
    return null;
  }
}

/**
 * Builds a partial User object from a JWT payload.
 * email, username, and createdAt are not stored in the JWT; they are
 * filled with empty strings until a profile call is made.
 */
function userFromPayload(payload: JwtPayload): User {
  return {
    id: payload.userId,
    username: '',
    email: '',
    role: payload.role,
    createdAt: '',
  };
}

// ─── Context type ─────────────────────────────────────────────────────────────

export interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  register: (username: string, email: string, password: string) => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

export const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount: restore session from localStorage
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (storedToken) {
      const payload = decodeJwtPayload(storedToken);
      if (payload) {
        setToken(storedToken);
        setUser(userFromPayload(payload));
      } else {
        // Token is expired or malformed — clean up
        localStorage.removeItem(TOKEN_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await authApi.login(email, password);
    localStorage.setItem(TOKEN_KEY, response.token);
    setToken(response.token);
    // AuthResponse.user contains id, username, role
    setUser({
      id: response.user.id,
      username: response.user.username,
      email,
      role: response.user.role,
      createdAt: '',
    });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    window.location.href = '/login';
  }, []);

  const register = useCallback(
    async (username: string, email: string, password: string) => {
      await authApi.register(username, email, password);
    },
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ user, token, isLoading, login, logout, register }),
    [user, token, isLoading, login, logout, register],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
