/**
 * ResultUseCase — application service for evaluating SQL attempt results.
 *
 * Pure domain logic: no framework imports, no infrastructure dependencies.
 * Comparison is done by normalizing both queries to a canonical form so that
 * differences in whitespace, casing (keywords) and trailing semicolons do not
 * produce false negatives.
 *
 * Invariant enforced here:
 *   status = 'correct'            → score = exerciseScore (> 0)
 *   status = 'incorrect' | 'error' → score = 0
 */

import type { IResultUseCase, EvaluationResult } from '../ports/in/IResultUseCase';
import type { IAttemptRepository } from '../ports/out/IAttemptRepository';

// ---------------------------------------------------------------------------
// SQL normalisation helpers
// ---------------------------------------------------------------------------

/**
 * SQL keywords that should be upper-cased during normalisation so that
 * `select` and `SELECT` are treated identically.
 */
const SQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER',
  'FULL', 'CROSS', 'ON', 'GROUP', 'BY', 'ORDER', 'HAVING', 'LIMIT',
  'OFFSET', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE',
  'CREATE', 'TABLE', 'ALTER', 'DROP', 'INDEX', 'DISTINCT', 'AS',
  'AND', 'OR', 'NOT', 'IN', 'IS', 'NULL', 'LIKE', 'BETWEEN', 'EXISTS',
  'UNION', 'ALL', 'EXCEPT', 'INTERSECT', 'CASE', 'WHEN', 'THEN', 'ELSE',
  'END', 'WITH', 'ASC', 'DESC',
];

const KEYWORD_REGEX = new RegExp(`\\b(${SQL_KEYWORDS.join('|')})\\b`, 'gi');

/**
 * Produces a canonical representation of a SQL string for comparison:
 * - Strips leading/trailing whitespace
 * - Removes trailing semicolons
 * - Collapses all internal whitespace sequences to a single space
 * - Upper-cases SQL keywords so `select` == `SELECT`
 */
function normalise(sql: string): string {
  return sql
    .trim()
    .replace(/;+\s*$/, '')               // remove trailing semicolons
    .replace(/\s+/g, ' ')                // collapse whitespace
    .replace(KEYWORD_REGEX, (m) => m.toUpperCase()); // normalise keyword casing
}

// ---------------------------------------------------------------------------
// Syntax validation — lightweight, framework-free heuristic
// ---------------------------------------------------------------------------

/**
 * Known SQL syntax error patterns (heuristic, not a full parser).
 * Detects the most common student mistakes without executing any query.
 */
const SYNTAX_ERROR_PATTERNS: Array<{ regex: RegExp; description: string }> = [
  { regex: /\bSELECT\s+FROM\b/i,           description: 'Missing column list after SELECT.' },
  { regex: /\bFROM\s+(WHERE|ORDER|GROUP|HAVING|LIMIT)\b/i, description: 'Missing table name after FROM.' },
  { regex: /\bWHERE\s+(ORDER|GROUP|HAVING|LIMIT)\b/i,       description: 'Incomplete WHERE clause.' },
  { regex: /\(\s*\)/,                       description: 'Empty parentheses found.' },
  { regex: /['"]\s*['"](?!\s*,)/,           description: 'Mismatched or empty string literal.' },
  { regex: /\bSELECT\b(?!.*\bFROM\b)/is,   description: 'SELECT statement is missing a FROM clause.' },
];

/**
 * Returns a syntax error description if the query contains obvious syntax
 * problems, or null if the query looks syntactically plausible.
 */
function detectSyntaxError(query: string): string | null {
  const trimmed = query.trim();

  // Completely empty after trimming
  if (trimmed.length === 0) {
    return 'The query is empty.';
  }

  // Must start with a recognisable DML/DDL keyword
  const startsWithValidKeyword = /^(SELECT|INSERT|UPDATE|DELETE|WITH|CREATE|ALTER|DROP)\b/i.test(trimmed);
  if (!startsWithValidKeyword) {
    return 'Query does not start with a recognised SQL statement.';
  }

  for (const { regex, description } of SYNTAX_ERROR_PATTERNS) {
    if (regex.test(trimmed)) {
      return description;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Hint generation
// ---------------------------------------------------------------------------

function buildHint(status: 'incorrect' | 'error', syntaxError: string | null): string {
  if (status === 'error') {
    if (syntaxError) {
      return `Your query has a syntax issue: ${syntaxError} Review the structure of your SQL statement and try again.`;
    }
    return 'Your query produced an execution error. Check for invalid column or table references and ensure the SQL is well-formed.';
  }

  // status === 'incorrect'
  return (
    'Your query ran without errors but did not return the expected result. ' +
    'Double-check your filtering conditions, column selections, and JOIN logic.'
  );
}

// ---------------------------------------------------------------------------
// ResultUseCase
// ---------------------------------------------------------------------------

export class ResultUseCase implements IResultUseCase {
  constructor(
    private readonly attemptRepository: IAttemptRepository,
  ) {}

  async evaluateAttempt(
    attemptId: string,
    querySent: string,
    expectedSolution: string,
    exerciseScore: number,
  ): Promise<EvaluationResult> {
    // 1. Detect syntax errors first
    const syntaxError = detectSyntaxError(querySent);

    let status: 'correct' | 'incorrect' | 'error';
    let score: number;
    let hint: string | null;

    if (syntaxError !== null) {
      // Syntax error → status=error, score=0
      status = 'error';
      score = 0;
      hint = buildHint('error', syntaxError);
    } else {
      // Compare normalised queries
      const normSent = normalise(querySent);
      const normExpected = normalise(expectedSolution);

      if (normSent === normExpected) {
        // Correct — enforce invariant: score must be > 0
        status = 'correct';
        score = exerciseScore > 0 ? exerciseScore : 1; // safety guard; exerciseScore should always be > 0
        hint = null;
      } else {
        // Syntactically valid but wrong result
        status = 'incorrect';
        score = 0;
        hint = buildHint('incorrect', null);
      }
    }

    // 2. Persist the evaluation outcome on the attempt record
    await this.attemptRepository.update(attemptId, { status, score });

    // 3. Return the evaluation result (invariant guaranteed by construction above)
    return { status, score, hint };
  }
}
