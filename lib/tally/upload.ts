'use client';

import { createClient } from '@/lib/supabase/client';

/**
 * Hard size cap that matches the bucket's file_size_limit (50 MB). Enforced
 * client-side so the user gets a friendly message before the upload starts.
 */
export const TALLY_UPLOAD_MAX_BYTES = 50 * 1024 * 1024;

/**
 * Inline (server-action body) ceiling. Vercel caps serverless request bodies
 * at 4.5 MB on Hobby and Pro; we stay well under that with a 2 MB threshold so
 * base64 expansion (~33%) and JSON envelope overhead never trip the limit.
 *
 * Files at or below this size are sent inline as `fileContent`. Larger files
 * are uploaded to Supabase Storage and referenced by `storagePath`.
 */
export const TALLY_INLINE_MAX_BYTES = 2 * 1024 * 1024;

const INLINE_CONTENT_TYPES: Record<string, string> = {
  xml: 'application/xml',
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
};

function detectExt(fileName: string): string {
  const lower = fileName.toLowerCase();
  const idx = lower.lastIndexOf('.');
  if (idx === -1) return 'bin';
  return lower.slice(idx + 1);
}

/**
 * Upload a Tally file to the user-scoped `tally-imports` bucket. Returns the
 * object path that should be passed to the server action as `storagePath`.
 *
 * RLS on the bucket requires the first path segment to equal the uploader's
 * auth.uid(), so we fetch the current user before building the path.
 */
export async function uploadTallyFileToStorage(
  file: File
): Promise<{ path: string }> {
  if (file.size > TALLY_UPLOAD_MAX_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    const maxMb = (TALLY_UPLOAD_MAX_BYTES / 1024 / 1024).toFixed(0);
    throw new Error(`File is ${mb} MB. Maximum is ${maxMb} MB.`);
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be signed in to upload.');

  const ext = detectExt(file.name);
  const random = Math.random().toString(36).slice(2, 10);
  const path = `${user.id}/${Date.now()}-${random}.${ext}`;
  const contentType =
    INLINE_CONTENT_TYPES[ext] ?? file.type ?? 'application/octet-stream';

  const { error } = await supabase.storage
    .from('tally-imports')
    .upload(path, file, {
      contentType,
      upsert: false,
      cacheControl: 'no-cache',
    });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }
  return { path };
}

/**
 * Remove a pending upload from the user's own folder. Used when the user
 * picks a different file or cancels, so the bucket doesn't fill with
 * never-confirmed previews.
 */
export async function deleteTallyUploadFromClient(
  path: string | undefined
): Promise<void> {
  if (!path) return;
  try {
    const supabase = createClient();
    await supabase.storage.from('tally-imports').remove([path]);
  } catch {
    /* best-effort — cron sweeps any leftovers */
  }
}
