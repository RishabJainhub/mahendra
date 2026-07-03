import { createServiceClient } from '@/lib/supabase/service';
import { logger } from '@/lib/logger';

export const TALLY_IMPORTS_BUCKET = 'tally-imports';

export type ResolvedTallyFile = {
  /** UTF-8 text for XML. Undefined for binary types. */
  text?: string;
  /** Node Buffer for binary types (PDF, XLSX). */
  buffer: Buffer;
};

/**
 * Download an uploaded Tally file from Supabase Storage using the service
 * role (bypasses RLS so the server can read any user's upload). Throws on
 * any failure so callers can surface a clean error.
 */
export async function fetchTallyUpload(path: string): Promise<ResolvedTallyFile> {
  const service = createServiceClient();
  const { data, error } = await service.storage
    .from(TALLY_IMPORTS_BUCKET)
    .download(path);

  if (error || !data) {
    const message = error?.message ?? 'No data returned from storage';
    logger.error('fetchTallyUpload failed', { path, error: message });
    throw new Error(`Could not fetch uploaded file: ${message}`);
  }

  const arrayBuffer = await data.arrayBuffer();
  const buf = Buffer.from(arrayBuffer);
  return { buffer: buf };
}

/**
 * Best-effort delete of an uploaded Tally object. Called after a successful
 * parse so the bucket never accumulates finished imports. Failures are
 * logged but never thrown — the daily pg_cron job sweeps any leftovers.
 */
export async function deleteTallyUpload(path: string | undefined): Promise<void> {
  if (!path) return;
  try {
    const service = createServiceClient();
    const { error } = await service.storage
      .from(TALLY_IMPORTS_BUCKET)
      .remove([path]);
    if (error) {
      logger.warn('deleteTallyUpload failed', { path, error: error.message });
    }
  } catch (err) {
    logger.warn('deleteTallyUpload exception', { path, err });
  }
}
