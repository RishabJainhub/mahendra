import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { getDashboardData } from '@/app/actions/dashboard';
import { DashboardCharts } from './dashboard-charts';
import { MonthEndBanner } from './month-end-banner';
import { PageHeader, PageShell } from '@/components/layout/page-header';

export default async function AdminDashboardPage() {
  const user = await requireAdmin();
  const data = await getDashboardData();

  return (
    <PageShell>
      <PageHeader title="Dashboard" description={user.tenant?.name ?? 'Tenant overview'}>
        <Link
          href="/admin/verify"
          className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-medium hover:bg-accent"
        >
          System Verify
        </Link>
        <Link
          href="/admin/suppliers"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Invite Supplier
        </Link>
      </PageHeader>
      <MonthEndBanner alert={data.monthEndAlert} />
      <DashboardCharts data={data} />
    </PageShell>
  );
}
