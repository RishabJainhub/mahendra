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
import { formatINR } from '@/lib/pricing';
import type { DashboardData } from '@/app/actions/dashboard';

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

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Bills</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.kpis.totalBills}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatINR(data.kpis.totalValue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Suppliers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.kpis.activeSuppliers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Bills Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.kpis.billsToday}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Supplier value (INR)</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {chartSuppliers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No supplier bill data yet.</p>
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
              <p className="text-sm text-muted-foreground">No import frequency data yet.</p>
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left">Supplier</th>
                  <th className="px-3 py-2 text-right">Bills</th>
                  <th className="px-3 py-2 text-right">Total (INR)</th>
                  <th className="px-3 py-2 text-left">Last bill</th>
                  <th className="px-3 py-2 text-right">Avg days between</th>
                  <th className="px-3 py-2 text-right">Imports/month</th>
                </tr>
              </thead>
              <tbody>
                {data.supplierStats.map((s) => (
                  <tr key={s.id} className="border-t">
                    <td className="px-3 py-2 font-medium">{s.name}</td>
                    <td className="px-3 py-2 text-right">{s.billCount}</td>
                    <td className="px-3 py-2 text-right">{formatINR(s.totalInr)}</td>
                    <td className="px-3 py-2">{s.lastBillDate ?? '—'}</td>
                    <td className="px-3 py-2 text-right">{s.avgDaysBetweenImports ?? '—'}</td>
                    <td className="px-3 py-2 text-right">{s.importsPerMonth}</td>
                  </tr>
                ))}
                {data.supplierStats.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                      No suppliers yet — invite one from Suppliers.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
