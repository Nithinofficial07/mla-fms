import pino from 'pino';
import { env, isProd } from './env.js';

/** App-wide structured logger. In dev it is pretty-printed. */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (env.NODE_ENV === 'test' ? 'silent' : 'info'),
  transport: isProd
    ? undefined
    : { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } },
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.passwordHash', '*.token'],
    remove: true,
  },
});
