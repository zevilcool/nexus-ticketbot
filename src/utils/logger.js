import { createLogger, format, transports } from 'winston';
import 'winston-daily-rotate-file';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_DIR   = join(__dirname, '../../logs');

const { combine, timestamp, colorize, printf, errors, json } = format;

const consoleFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, stack, ...meta }) =>
    `[${ts}] ${level}: ${stack ?? message}${Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ''}`
  )
);

const fileFormat = combine(timestamp(), errors({ stack: true }), json());

const log = createLogger({
  level: process.env.LOG_LEVEL ?? 'info',
  transports: [
    new transports.Console({ format: consoleFormat }),

    new transports.DailyRotateFile({
      format:       fileFormat,
      dirname:      LOG_DIR,
      filename:     'bot-%DATE%.log',
      datePattern:  'YYYY-MM-DD',
      maxFiles:     '14d',
      maxSize:      '20m',
      zippedArchive: true,
    }),

    new transports.DailyRotateFile({
      level:        'error',
      format:       fileFormat,
      dirname:      LOG_DIR,
      filename:     'error-%DATE%.log',
      datePattern:  'YYYY-MM-DD',
      maxFiles:     '30d',
      maxSize:      '20m',
      zippedArchive: true,
    }),
  ],
});

export default log;
