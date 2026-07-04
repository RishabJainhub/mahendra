'use client';

import { useEffect } from 'react';

/**
 * Swallow transient browser-level network and session rejections that the
 * Supabase JS SDK leaks as unhandled promise rejections. Known offenders:
 *
 *   1. `TypeError: Failed to fetch` — thrown by `fetch()` when a network
 *      request fails. Supabase's auth realtime WebSocket reconnect and
 *      `getUser()` calls surface this on idle tabs, network blips, or after a
 *      long-running dev server. The SDK retries internally; the rejected
 *      promise is pure noise.
 *   2. `TypeError: NetworkError when attempting to fetch resource` — Firefox
 *      variant of the same condition.
 *   3. `AuthApiError: Invalid Refresh Token: Refresh Token Not Found` —
 *      thrown when the SSR/client SDK tries to refresh an expired session.
 *      The app already handles this gracefully (middleware + auth actions
 *      redirect to /login); the unhandled rejection just panics the dev
 *      overlay.
 *
 * These are never actionable from a UI modal — the app already recovers
 * (redirects to login, retries, or shows the last-known state) — so
 * suppressing them keeps the Next.js dev error overlay from hijacking the
 * screen. Real application errors (with actual stack frames and messages)
 * still surface normally.
 */
const TRANSIENT_ERROR_PATTERNS: string[] = [
  'Failed to fetch',
  'NetworkError when attempting to fetch resource',
  'network error',
  'Invalid Refresh Token',
  'Refresh Token Not Found',
  'refresh_token_not_found',
];

function isTransientError(reason: unknown): boolean {
  if (reason == null) return false;
  const err = reason instanceof Error ? reason : new Error(String(reason));
  const msg = err.message ?? '';
  return TRANSIENT_ERROR_PATTERNS.some((p) => msg.includes(p));
}

export function NetworkErrorHandler() {
  useEffect(() => {
    const onUnhandled = (event: PromiseRejectionEvent) => {
      if (isTransientError(event.reason)) {
        event.preventDefault();
      }
    };

    const onError = (event: ErrorEvent) => {
      if (isTransientError(event.error ?? event.message)) {
        event.preventDefault();
      }
    };

    window.addEventListener('unhandledrejection', onUnhandled);
    window.addEventListener('error', onError);
    return () => {
      window.removeEventListener('unhandledrejection', onUnhandled);
      window.removeEventListener('error', onError);
    };
  }, []);

  return null;
}
