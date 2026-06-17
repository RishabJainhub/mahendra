'use server';

import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';

export type SupplierStat = {
  id: string;
  name: string;
  billCount: number;
  totalInr: number;
  lastBillDate: string | null;
  avgDaysBetweenImports: number | null;
  importsPerMonth: number;
};

export type MonthlyTrend = {
  month: string;
  billCount: number;
  totalInr: number;
};

export type DashboardData = {
  kpis: {
    totalBills: number;
    totalValue: number;
    activeSuppliers: number;
    billsToday: number;
  };
  supplierStats: SupplierStat[];
  monthlyTrend: MonthlyTrend[];
};

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function avgGapDays(dates: string[]): number | null {
  if (dates.length < 2) return null;
  const sorted = dates.map((d) => new Date(d).getTime()).sort((a, b) => a - b);
  let totalGap = 0;
  for (let i = 1; i < sorted.length; i++) {
    totalGap += (sorted[i] - sorted[i - 1]) / (1000 * 60 * 60 * 24);
  }
  return Math.round((totalGap / (sorted.length - 1)) * 10) / 10;
}

export async function getDashboardData(): Promise<DashboardData> {
  await requireAdmin();
  const supabase = await createClient();

  const { count: totalBills } = await supabase
    .from('bills')
    .select('*', { count: 'exact', head: true });

  const { data: allBills } = await supabase
    .from('bills')
    .select('id, supplier_id, total_amount, bill_date, created_at, status')
    .neq('status', 'cancelled');

  const bills = allBills ?? [];
  const totalValue = bills.reduce((s, b) => s + Number(b.total_amount), 0);

  const { count: activeSuppliers } = await supabase
    .from('suppliers')
    .select('*', { count: 'exact', head: true })
    .eq('active', true);

  const today = new Date().toISOString().slice(0, 10);
  const { count: billsToday } = await supabase
    .from('bills')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', `${today}T00:00:00`);

  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('id, name')
    .eq('active', true)
    .order('name');

  const supplierStats: SupplierStat[] = (suppliers ?? []).map((s) => {
    const sb = bills.filter((b) => b.supplier_id === s.id);
    const dates = sb.map((b) => b.bill_date).filter(Boolean) as string[];
    const lastBillDate = dates.length
      ? dates.sort().reverse()[0]
      : null;

    const monthsActive = new Set(dates.map((d) => monthKey(new Date(d)))).size || 1;

    return {
      id: s.id,
      name: s.name,
      billCount: sb.length,
      totalInr: sb.reduce((sum, b) => sum + Number(b.total_amount), 0),
      lastBillDate,
      avgDaysBetweenImports: avgGapDays(dates),
      importsPerMonth: Math.round((sb.length / monthsActive) * 10) / 10,
    };
  });

  supplierStats.sort((a, b) => b.totalInr - a.totalInr);

  const monthMap = new Map<string, { billCount: number; totalInr: number }>();
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthMap.set(monthKey(d), { billCount: 0, totalInr: 0 });
  }

  for (const b of bills) {
    const key = monthKey(new Date(b.bill_date));
    if (!monthMap.has(key)) continue;
    const entry = monthMap.get(key)!;
    entry.billCount += 1;
    entry.totalInr += Number(b.total_amount);
  }

  const monthlyTrend: MonthlyTrend[] = Array.from(monthMap.entries()).map(([month, v]) => ({
    month,
    billCount: v.billCount,
    totalInr: v.totalInr,
  }));

  return {
    kpis: {
      totalBills: totalBills ?? 0,
      totalValue,
      activeSuppliers: activeSuppliers ?? 0,
      billsToday: billsToday ?? 0,
    },
    supplierStats,
    monthlyTrend,
  };
}
