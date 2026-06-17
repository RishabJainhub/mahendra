import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger, newRequestId } from '@/lib/logger';

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MiB, matches bucket limit
const SIGNED_URL_TTL_SECONDS = 60 * 5; // 5 minutes

function sanitizeFileName(name: string): string {
  // Strip any path components and keep a conservative character set.
  const base = name.split(/[\\/]/).pop() ?? 'upload';
  return base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200) || 'upload';
}

export async function POST(request: Request) {
  const reqId = newRequestId();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const role = user?.app_metadata?.role as string | undefined;
  const tenantId = user?.app_metadata?.tenant_id as string | undefined;
  if (!user || role !== 'admin' || !tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'File too large' }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  // Tenant-scoped path so storage RLS isolates files per tenant.
  const path = `${tenantId}/${Date.now()}-${sanitizeFileName(file.name)}`;

  const { data, error } = await supabase.storage
    .from('tally-imports')
    .upload(path, buffer, { contentType: file.type, upsert: false });

  if (error) {
    logger.error('bill upload failed', { reqId, error: error.message });
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }

  // Private bucket: return a short-lived signed URL, never a public URL.
  const { data: signed, error: signError } = await supabase.storage
    .from('tally-imports')
    .createSignedUrl(data.path, SIGNED_URL_TTL_SECONDS);

  if (signError || !signed) {
    logger.error('bill upload sign failed', { reqId, error: signError?.message });
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }

  return NextResponse.json({ url: signed.signedUrl, path: data.path });
}
