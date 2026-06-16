import { createClient } from '@supabase/supabase-js';

export function createServiceClient() {
  // Defense in depth: the service-role key bypasses RLS and must never run in
  // a browser bundle. Fail loudly if this is ever reached client-side.
  if (typeof window !== 'undefined') {
    throw new Error('createServiceClient must not be called in the browser');
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing Supabase service role configuration');
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
