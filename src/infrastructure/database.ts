import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { env } from './env';

/**
 * PostgreSQL connection pool using DATABASE_URL from environment.
 */
const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

pool.on('error', (err: Error) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
  process.exit(1);
});

/**
 * Execute a parameterized SQL query using the connection pool.
 * @param sql - The SQL statement to execute
 * @param params - Optional array of query parameters
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return pool.query<T>(sql, params);
}

/**
 * Acquire a dedicated pool client for use in transactions.
 * The caller is responsible for calling client.release() when done.
 */
export async function getClient(): Promise<PoolClient> {
  return pool.connect();
}

export default pool;
