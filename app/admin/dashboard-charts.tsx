'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { EmptyState } from '@/components/layout/empty-state';
import { formatINR } from '@/lib/pricing';
import type { DashboardData } from '@/app/actions/dashboard';
import { Receipt, IndianRupee, Users, CalendarDays, BarChart3 } from 'lucide-react';

type Props = {
  data: DashboardData;
};

function formatMonthLabel(month: string): string {
  const [y, m] = month.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
}

export function DashboardCharts({ data }: Props) {
  const chartSuppliers = data.supplierStats.slice(0, 10).map((s) => ({
    name: s.name.length > 14 ? `${s.name.slice(0, 14)}…` : s.name,
    totalInr: s.totalInr,
    billCount: s.billCount,
    frequency: s.importsPerMonth,
  }));

  const trendData = data.monthlyTrend.map((m) => ({
    month: formatMonthLabel(m.month),
    bills: m.billCount,
    value: m.totalInr,
  }));

  const kpis = [
    { label: 'Total bills', value: String(data.kpis.totalBills), icon: <Receipt className="h-4 w-4" /> },
    { label: 'Total value', value: formatINR(data.kpis.totalValue), icon: <IndianRupee className="h-4 w-4" /> },
    { label: 'Active suppliers', value: String(data.kpis.activeSuppliers), icon: <Users className="h-4 w-4" /> },
    { label: 'Bills today', value: String(data.kpis.billsToday), icon: <CalendarDays className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <span className="text-muted-foreground">{kpi.icon}</span>
                {kpi.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">{kpi.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Supplier value (INR)</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {chartSuppliers.length === 0 ? (
              <EmptyState
                icon={<BarChart3 className="h-8 w-8" />}
                title="No supplier data yet"
                description="Bill totals per supplier will chart here once imports begin."
                className="py-8"
              />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartSuppliers} margin={{ left: 8, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => formatINR(v)} />
                  <Bar dataKey="totalInr" fill="hsl(var(--primary))" name="Total INR" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Import frequency (bills / month)</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {chartSuppliers.length === 0 ? (
              <EmptyState
                icon={<BarChart3 className="h-8 w-8" />}
                title="No import data yet"
                description="Import frequency will chart here as suppliers upload Tally bills."
                className="py-8"
              />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartSuppliers} margin={{ left: 8, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals />
                  <Tooltip />
                  <Bar dataKey="frequency" fill="hsl(220 70% 50%)" name="Bills/month" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Monthly trend (last 6 months)</CardTitle>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData} margin={{ left: 8, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(value: number, name: string) =>
                  name === 'Value (INR)' ? formatINR(value) : value
                }
              />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="bills" stroke="hsl(var(--primary))" name="Bill count" strokeWidth={2} />
              <Line yAxisId="right" type="monotone" dataKey="value" stroke="hsl(142 70% 40%)" name="Value (INR)" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Supplier statistics</CardTitle>
        </CardHeader>
        <CardContent>
          {data.supplierStats.length === 0 ? (
            <EmptyState
              icon={<Users className="h-8 w-8" />}
              title="No suppliers yet"
              description="Invite a supplier from Suppliers to start seeing statistics here."
              className="py-8"
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>Supplier</TH>
                    <TH align="right">Bills</TH>
                    <TH align="right">Total (INR)</TH>
                    <TH>Last bill</TH>
                    <TH align="right">Avg days between</TH>
                    <TH align="right">Imports/month</TH>
                  </TR>
                </THead>
                <TBody>
                  {data.supplierStats.map((s) => (
                    <TR key={s.id}>
                      <TD className="font-medium">{s.name}</TD>
                      <TD align="right" className="tabular-nums">{s.billCount}</TD>
                      <TD align="right" className="tabular-nums">{formatINR(s.totalInr)}</TD>
                      <TD className="text-muted-foreground">{s.lastBillDate ?? '—'}</TD>
                      <TD align="right" className="tabular-nums">{s.avgDaysBetweenImports ?? '—'}</TD>
                      <TD align="right" className="tabular-nums">{s.importsPerMonth}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
