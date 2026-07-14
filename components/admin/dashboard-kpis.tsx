import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatINR } from '@/lib/pricing';
import { Receipt, IndianRupee, Users, CalendarDays } from 'lucide-react';

type Props = {
  kpis: {
    totalBills: number;
    totalValue: number;
    activeSuppliers: number;
    billsToday: number;
  };
};

export function DashboardKpis({ kpis }: Props) {
  const items = [
    { label: 'Total bills', value: String(kpis.totalBills), icon: Receipt },
    { label: 'Total value', value: formatINR(kpis.totalValue), icon: IndianRupee },
    { label: 'Active suppliers', value: String(kpis.activeSuppliers), icon: Users },
    { label: 'Bills today', value: String(kpis.billsToday), icon: CalendarDays },
  ];

  return (
    <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {items.map((kpi) => {
        const Icon = kpi.icon;
        return (
          <Card key={kpi.label}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Icon className="h-4 w-4" />
                {kpi.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">{kpi.value}</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
