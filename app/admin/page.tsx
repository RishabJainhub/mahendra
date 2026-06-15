import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { formatINR } from '@/lib/pricing';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function AdminDashboardPage() {
  const user = await requireAdmin();
  const supabase = await createClient();

  const { count: totalBills } = await supabase
    .from('bills')
    .select('*', { count: 'exact', head: true });

  const { data: valueData } = await supabase
    .from('bills')
    .select('total_amount')
    .neq('status', 'cancelled');

  const totalValue = (valueData ?? []).reduce((sum, b) => sum + Number(b.total_amount), 0);

  const { count: activeSuppliers } = await supabase
    .from('suppliers')
    .select('*', { count: 'exact', head: true })
    .eq('active', true);

  const today = new Date().toISOString().slice(0, 10);
  const { count: billsToday } = await supabase
    .from('bills')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', `${today}T00:00:00`);

  const kpis = [
    { label: 'Total Bills', value: String(totalBills ?? 0) },
    { label: 'Total Value', value: formatINR(totalValue) },
    { label: 'Active Suppliers', value: String(activeSuppliers ?? 0) },
    { label: 'Bills Today', value: String(billsToday ?? 0) },
  ];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Dashboard</h1>
      <p className="mb-4 text-muted-foreground">{user.tenant?.name ?? 'Tenant'}</p>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
