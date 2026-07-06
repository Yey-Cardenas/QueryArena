// ─── Domain types ────────────────────────────────────────────────────────────

export type UserRole = 'student' | 'admin';

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  createdAt: string; // ISO 8601 date string
}

// ─── Exercise ────────────────────────────────────────────────────────────────

export interface Level {
  id: number;
  name: string;
  createdAt?: string; // ISO 8601 date string — populated by admin API
}

export interface Category {
  id: number;
  name: string;
}

export interface Exercise {
  id: string;
  title: string;
  description: string;
  level: Level;
  category: Category;
  score: number;
  isActive: boolean;
  createdAt: string;
}

/** Full exercise detail (includes the statement/enunciado). */
export interface ExerciseDetail extends Exercise {
  expectedSolution?: string; // Only visible to admins
}

// ─── Attempt ─────────────────────────────────────────────────────────────────

export type AttemptStatus = 'correct' | 'incorrect' | 'error';

export interface Attempt {
  id: string;
  userId: string;
  exerciseId: string;
  exerciseTitle?: string; // Populated in history/dashboard responses
  querySent: string;
  status: AttemptStatus;
  score: number;
  resolutionTimeMs: number;
  createdAt: string;
  hint?: string | null;
}

// ─── Ranking ─────────────────────────────────────────────────────────────────

export interface RankingEntry {
  position: number;
  username: string;
  accumulatedScore: number;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthResponse {
  token: string;
  user: Pick<User, 'id' | 'username' | 'role'>;
}

// ─── API Error ───────────────────────────────────────────────────────────────

export interface ApiErrorBody {
  code: string;
  message: string;
  field?: string;
}

export interface ApiError {
  error: ApiErrorBody;
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export interface DashboardSummary {
  totalAttempted: number;
  totalCorrect: number;
  accumulatedScore: number;
  rankingPosition: number | null;
}

export interface ProgressByGroup {
  id: number;
  name: string;
  attempted: number;
  correct: number;
}
