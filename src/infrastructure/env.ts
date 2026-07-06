/**
 * Environment variable validation and export.
 * Throws a descriptive error at startup if any required variable is missing or invalid.
 *
 * Required:   DATABASE_URL, JWT_SECRET, JWT_EXPIRES_IN, BCRYPT_COST
 * Optional:   PORT (default 3000), NODE_ENV (default "development"),
 *             CORS_ORIGIN (default "*" — restrict in production)
 */

const required = ['DATABASE_URL', 'JWT_SECRET', 'JWT_EXPIRES_IN', 'BCRYPT_COST'] as const;

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(
      `Missing required environment variable: ${key}. ` +
      `Please set ${key} before starting the application.`
    );
  }
}

const bcryptCost = parseInt(process.env.BCRYPT_COST!, 10);
if (isNaN(bcryptCost) || bcryptCost < 10) {
  throw new Error(
    `Invalid value for BCRYPT_COST: "${process.env.BCRYPT_COST}". ` +
    `Must be an integer >= 10.`
  );
}

const port = parseInt(process.env.PORT ?? '3000', 10);
if (isNaN(port) || port < 1 || port > 65535) {
  throw new Error(
    `Invalid value for PORT: "${process.env.PORT}". Must be an integer between 1 and 65535.`
  );
}

export const env = {
  DATABASE_URL: process.env.DATABASE_URL!,
  JWT_SECRET: process.env.JWT_SECRET!,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN!,
  BCRYPT_COST: bcryptCost,
  PORT: port,
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? '*',
  NODE_ENV: (process.env.NODE_ENV ?? 'development') as 'development' | 'test' | 'production',
} as const;
