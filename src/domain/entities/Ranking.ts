/**
 * Ranking domain entity.
 * No external dependencies — pure TypeScript types only.
 */

export interface Ranking {
  id: string;                       // UUID
  user_id: string;                  // UUID — references User.id (unique)
  accumulated_score: number;
  last_correct_at: Date | null;
  updated_at: Date;
}
