import winston from 'winston';
import { env } from '../config/env.js';

const isDevelopment = env.NODE_ENV === 'development';
const isProduction = env.NODE_ENV === 'production';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  isProduction
    ? winston.format.json()
    : winston.format.printf(({ level, message, timestamp, correlationId, ...meta }) => {
        const correlation = correlationId ? ` [${correlationId}]` : '';
        const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp} [${level.toUpperCase()}]${correlation} ${message}${metaStr}`;
      }),
);

const transports: winston.transport[] = [
  new winston.transports.Console({
    level: isDevelopment ? 'debug' : 'info',
  }),
];

if (isProduction) {
  transports.push(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10485760,
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10485760,
      maxFiles: 10,
    }),
  );
}

const winstonLogger = winston.createLogger({
  level: isDevelopment ? 'debug' : 'info',
  format: logFormat,
  transports,
});

export class LoggerService {
  private correlationId?: string;

  setCorrelationId(correlationId: string): void {
    this.correlationId = correlationId;
  }

  getCorrelationId(): string | undefined {
    return this.correlationId;
  }

  private log(level: string, message: string, meta?: Record<string, unknown>): void {
    const context = this.correlationId ? { correlationId: this.correlationId, ...meta } : meta;
    winstonLogger.log(level, message, context);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.log('debug', message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.log('warn', message, meta);
  }

  error(message: string, error?: Error | Record<string, unknown>, meta?: Record<string, unknown>): void {
    const errorMeta = error instanceof Error
      ? { error: { message: error.message, stack: error.stack, ...meta } }
      : { ...error, ...meta };
    this.log('error', message, errorMeta);
  }
}

export const logger = new LoggerService();
