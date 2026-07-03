import { requireAdmin } from '@/lib/auth';
import { getDashboardData } from '@/app/actions/dashboard';
import { DashboardCharts } from './dashboard-charts';
import { MonthEndBanner } from './month-end-banner';
import { PageHeader, PageShell } from '@/components/layout/page-header';
import { ButtonLink } from '@/components/ui/button-link';
import { ShieldCheck, UserPlus } from 'lucide-react';

export default async function AdminDashboardPage() {
  const user = await requireAdmin();
  const data = await getDashboardData();

  return (
    <PageShell>
      <PageHeader title="Dashboard" description={user.tenant?.name ?? 'Tenant overview'}>
        <ButtonLink href="/admin/verify" variant="outline">
          <ShieldCheck className="mr-1.5 h-4 w-4" />
          System verify
        </ButtonLink>
        <ButtonLink href="/admin/suppliers">
          <UserPlus className="mr-1.5 h-4 w-4" />
          Invite supplier
        </ButtonLink>
      </PageHeader>
      <MonthEndBanner alert={data.monthEndAlert} />
      <DashboardCharts data={data} />
    </PageShell>
  );
}
