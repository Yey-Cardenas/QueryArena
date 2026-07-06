import winston from 'winston';

/**
 * Structured logger using Winston.
 *
 * - Production (NODE_ENV=production): JSON format to stdout
 * - Development / test: colorized console format
 */
export class WinstonLogger {
  private readonly logger: winston.Logger;

  constructor() {
    const isProduction = process.env.NODE_ENV === 'production';

    const format = isProduction
      ? winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.json(),
        )
      : winston.format.combine(
          winston.format.timestamp({ format: 'HH:mm:ss' }),
          winston.format.errors({ stack: true }),
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            const metaStr = Object.keys(meta).length
              ? ' ' + JSON.stringify(meta)
              : '';
            return `${timestamp} [${level}]: ${message}${metaStr}`;
          }),
        );

    const transports: winston.transport[] = [
      new winston.transports.Console({ format }),
    ];

    this.logger = winston.createLogger({
      level: 'debug',
      transports,
    });
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.logger.info(message, meta ?? {});
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.logger.warn(message, meta ?? {});
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.logger.error(message, meta ?? {});
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.logger.debug(message, meta ?? {});
  }
}

/** Singleton logger instance ready for injection */
export const logger = new WinstonLogger();
