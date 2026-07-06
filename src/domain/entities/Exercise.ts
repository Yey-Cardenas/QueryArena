/**
 * Exercise domain entity.
 * No external dependencies — pure TypeScript types only.
 */

export interface Level {
  id: number;
  name: string;
  created_at: Date;
}

export interface Category {
  id: number;
  name: string;
  created_at: Date;
}

export interface Exercise {
  id: string;               // UUID
  title: string;
  description: string;
  expected_solution: string;
  score: number;
  is_active: boolean;
  level_id: number;
  category_id: number;
  created_at: Date;
  updated_at: Date;
  // Optional embedded objects for when joins are performed
  level?: Level;
  category?: Category;
}
