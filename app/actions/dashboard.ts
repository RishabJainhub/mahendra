'use server';

import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { todayIst } from '@/lib/tally/dates';

export type MonthEndAlert = {
  month: string;
  billCount: number;
  exported: boolean;
};

export type DashboardData = {
  kpis: {
    totalBills: number;
    totalValue: number;
    activeSuppliers: number;
    billsToday: number;
  };
  monthEndAlert: MonthEndAlert;
};

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export async function getDashboardData(): Promise<DashboardData> {
  await requireAdmin();
  const supabase = await createClient();

  const { count: totalBills } = await supabase
    .from('bills')
    .select('*', { count: 'exact', head: true });

  const { data: allBills } = await supabase
    .from('bills')
    .select('total_amount, bill_date, status')
    .neq('status', 'cancelled');

  const bills = allBills ?? [];
  const totalValue = bills.reduce((s, b) => s + Number(b.total_amount), 0);

  const { count: activeSuppliers } = await supabase
    .from('suppliers')
    .select('*', { count: 'exact', head: true })
    .eq('active', true);

  const today = todayIst();
  const { count: billsToday } = await supabase
    .from('bills')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', `${today}T00:00:00+05:30`);

  const now = new Date();
  const currentMonth = monthKey(now);
  const currentMonthBillCount = bills.filter(
    (b) => monthKey(new Date(b.bill_date)) === currentMonth
  ).length;

  const { data: monthExport } = await supabase
    .from('tenant_month_exports')
    .select('month')
    .eq('month', currentMonth)
    .maybeSingle();

  return {
    kpis: {
      totalBills: totalBills ?? 0,
      totalValue,
      activeSuppliers: activeSuppliers ?? 0,
      billsToday: billsToday ?? 0,
    },
    monthEndAlert: {
      month: currentMonth,
      billCount: currentMonthBillCount,
      exported: Boolean(monthExport),
    },
  };
}
