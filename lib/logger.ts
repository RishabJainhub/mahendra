import { randomUUID } from 'crypto';

export function newRequestId(): string {
  return randomUUID();
}

type LogMeta = Record<string, unknown>;

function log(level: 'info' | 'warn' | 'error', msg: string, meta?: LogMeta) {
  const payload = meta ? { msg, ...meta } : { msg };
  // eslint-disable-next-line no-console
  console[level](`[${level}]`, JSON.stringify(payload));
}

export const logger = {
  info: (msg: string, meta?: LogMeta) => log('info', msg, meta),
  warn: (msg: string, meta?: LogMeta) => log('warn', msg, meta),
  error: (msg: string, meta?: LogMeta) => log('error', msg, meta),
};
