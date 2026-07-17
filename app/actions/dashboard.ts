'use server';

import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { todayIst } from '@/lib/tally/dates';

export type DashboardData = {
  kpis: {
    totalBills: number;
    totalValue: number;
    activeSuppliers: number;
    billsToday: number;
  };
};

export async function getDashboardData(): Promise<DashboardData> {
  await requireAdmin();
  const supabase = await createClient();

  const { count: totalBills } = await supabase
    .from('bills')
    .select('*', { count: 'exact', head: true })
    .is('admin_hidden_at', null);

  const { data: allBills } = await supabase
    .from('bills')
    .select('total_amount, status')
    .is('admin_hidden_at', null)
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
    .is('admin_hidden_at', null)
    .gte('created_at', `${today}T00:00:00+05:30`);

  return {
    kpis: {
      totalBills: totalBills ?? 0,
      totalValue,
      activeSuppliers: activeSuppliers ?? 0,
      billsToday: billsToday ?? 0,
    },
  };
}
