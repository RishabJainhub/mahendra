import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AdminLayout } from '@/components/layout/admin-layout';

export const dynamic = 'force-dynamic';

export default async function AdminRootLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  // Unprinted-bill count for the sidebar badge. Best-effort — the layout
  // renders fine without it.
  let unprintedCount = 0;
  try {
    const supabase = await createClient();
    const { count } = await supabase
      .from('bills')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'imported');
    unprintedCount = count ?? 0;
  } catch {
    /* non-fatal */
  }

  return <AdminLayout unprintedCount={unprintedCount}>{children}</AdminLayout>;
}
