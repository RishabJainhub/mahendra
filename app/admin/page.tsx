import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { getDashboardData } from '@/app/actions/dashboard';
import { DashboardCharts } from './dashboard-charts';

export default async function AdminDashboardPage() {
  const user = await requireAdmin();
  const data = await getDashboardData();

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">{user.tenant?.name ?? 'Tenant'}</p>
        </div>
        <Link
          href="/admin/verify"
          className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-medium hover:bg-accent"
        >
          Run system verify
        </Link>
      </div>
      <DashboardCharts data={data} />
    </div>
  );
}
