import { ZodError } from 'zod';

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string; meta?: Record<string, unknown> };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(
  error: string,
  code?: string,
  meta?: Record<string, unknown>
): ActionResult<never> {
  return { ok: false, error, code, meta };
}

export function fromZod(error: ZodError): ActionResult<never> {
  const message = error.errors.map((e) => e.message).join('; ');
  return fail(message, 'VALIDATION_ERROR');
}
