/**
 * Barrel export for all input port (driving port) interfaces.
 */

export type { IAuthUseCase } from './IAuthUseCase';

export type { IUserUseCase, UserProfileDto } from './IUserUseCase';

export type {
  IExerciseUseCase,
  ExerciseSummary,
  ExerciseDetail,
  ExerciseFilters,
} from './IExerciseUseCase';

export type {
  IAttemptUseCase,
  AttemptResult,
  AttemptHistoryItem,
} from './IAttemptUseCase';

export type { IResultUseCase, EvaluationResult } from './IResultUseCase';

export type { IRankingUseCase, RankingEntry } from './IRankingUseCase';

export type {
  IDashboardUseCase,
  DashboardSummary,
  LevelProgress,
  CategoryProgress,
  RecentAttempt,
} from './IDashboardUseCase';

export type { IAdminUseCase, CreateExerciseDto } from './IAdminUseCase';
