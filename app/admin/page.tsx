import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getDashboardData } from '@/app/actions/dashboard';
import { DashboardActions } from '@/components/admin/dashboard-actions';
import { DashboardKpis } from '@/components/admin/dashboard-kpis';
import { PageHeader, PageShell } from '@/components/layout/page-header';

export default async function AdminDashboardPage() {
  const user = await requireAdmin();
  const data = await getDashboardData();

  let unprintedCount = 0;
  try {
    const supabase = await createClient();
    const { count } = await supabase
      .from('bills')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'imported')
      .is('admin_hidden_at', null);
    unprintedCount = count ?? 0;
  } catch {
    /* non-fatal */
  }

  return (
    <PageShell>
      <PageHeader
        title="Home"
        description={user.tenant?.name ?? 'What do you need to do today?'}
      />
      <DashboardKpis kpis={data.kpis} />
      <DashboardActions unprintedCount={unprintedCount} />
    </PageShell>
  );
}
