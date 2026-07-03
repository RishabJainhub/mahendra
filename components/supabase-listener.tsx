'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

/** Auth events that should sync server-rendered session state with the client. */
const REFRESH_EVENTS = new Set(['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED', 'PASSWORD_RECOVERY']);

export function SupabaseListener() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      // INITIAL_SESSION and TOKEN_REFRESHED fire on every mount/refresh — refreshing
      // the router for those causes an infinite reload loop on dashboard pages.
      if (!REFRESH_EVENTS.has(event)) return;
      setTimeout(() => router.refresh(), 0);
    });
    return () => subscription.unsubscribe();
  }, [router]);

  return null;
}
