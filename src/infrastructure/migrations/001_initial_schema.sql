-- =============================================================================
-- QueryArena — Initial Database Schema
-- Migration: 001_initial_schema.sql
-- =============================================================================

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- Table: users
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    username      VARCHAR(50)  NOT NULL UNIQUE,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(20)  NOT NULL DEFAULT 'student'
                                CHECK (role IN ('student', 'admin')),
    is_active     BOOLEAN      NOT NULL DEFAULT true,
    created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Table: levels
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS levels (
    id         SERIAL       PRIMARY KEY,
    name       VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Table: categories
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
    id         SERIAL       PRIMARY KEY,
    name       VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Table: exercises
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exercises (
    id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    title             VARCHAR(255) NOT NULL,
    description       TEXT         NOT NULL,
    expected_solution TEXT         NOT NULL,
    score             INTEGER      NOT NULL DEFAULT 10 CHECK (score > 0),
    is_active         BOOLEAN      NOT NULL DEFAULT true,
    level_id          INTEGER      NOT NULL REFERENCES levels(id),
    category_id       INTEGER      NOT NULL REFERENCES categories(id),
    created_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Table: attempts
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attempts (
    id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID        NOT NULL REFERENCES users(id),
    exercise_id        UUID        NOT NULL REFERENCES exercises(id),
    query_sent         TEXT        NOT NULL,
    status             VARCHAR(20) NOT NULL CHECK (status IN ('correct', 'incorrect', 'error')),
    score              INTEGER     NOT NULL DEFAULT 0 CHECK (score >= 0),
    resolution_time_ms INTEGER     NOT NULL DEFAULT 0 CHECK (resolution_time_ms >= 0),
    created_at         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Table: rankings
-- Denormalized table for O(1) leaderboard queries.
-- Updated asynchronously after each correct attempt.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rankings (
    id                UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID     NOT NULL UNIQUE REFERENCES users(id),
    accumulated_score INTEGER  NOT NULL DEFAULT 0 CHECK (accumulated_score >= 0),
    last_correct_at   TIMESTAMP WITH TIME ZONE,
    updated_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------

-- attempts: fast lookup by user and by exercise (history queries, count queries)
CREATE INDEX IF NOT EXISTS idx_attempts_user_id     ON attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_exercise_id ON attempts(exercise_id);
-- attempts: ordered history (most recent first)
CREATE INDEX IF NOT EXISTS idx_attempts_created_at  ON attempts(created_at DESC);
-- attempts: composite index for filtered history (user + exercise, ordered)
CREATE INDEX IF NOT EXISTS idx_attempts_user_exercise_created
    ON attempts(user_id, exercise_id, created_at DESC);

-- exercises: fast filtering by level and category
CREATE INDEX IF NOT EXISTS idx_exercises_level_id    ON exercises(level_id);
CREATE INDEX IF NOT EXISTS idx_exercises_category_id ON exercises(category_id);
-- exercises: only active exercises are served to students
CREATE INDEX IF NOT EXISTS idx_exercises_is_active   ON exercises(is_active);

-- rankings: leaderboard ordering (score DESC, last_correct_at ASC for tiebreak)
CREATE INDEX IF NOT EXISTS idx_rankings_score_date
    ON rankings(accumulated_score DESC, last_correct_at ASC NULLS LAST);
