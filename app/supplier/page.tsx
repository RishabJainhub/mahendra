import Link from 'next/link';
import { requireSupplier } from '@/lib/auth';
import { getSupplierDashboard } from '@/app/actions/supplier';
import { formatINR } from '@/lib/pricing';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default async function SupplierDashboardPage() {
  const user = await requireSupplier();
  const { bills, totalBills, printedBills, lastImport, pricingRule, imports } = await getSupplierDashboard();

  const kpis = [
    { label: 'Total Bills', value: String(totalBills) },
    { label: 'Stickers Printed', value: String(printedBills) },
    { label: 'Last Import', value: lastImport?.created_at ? new Date(lastImport.created_at).toLocaleDateString('en-IN') : '—' },
    { label: 'Pricing Model', value: pricingRule?.model ?? 'standard' },
  ];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Dashboard</h1>
      <p className="mb-4 text-muted-foreground">Welcome, {user.supplier?.name}</p>

      <div className="mb-6 flex gap-3">
        <Link href="/supplier/import" className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Import Tally Bill
        </Link>
        <Link href="/supplier/print" className="inline-flex h-10 items-center rounded-md border border-border px-4 text-sm font-medium hover:bg-accent">
          Print Barcodes
        </Link>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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

      <h2 className="mb-3 text-lg font-semibold">Recent Bills</h2>
      <div className="mb-8 overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left">Bill #</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {bills.map((bill) => (
              <tr key={bill.id} className="border-t">
                <td className="px-4 py-3">{bill.bill_number}</td>
                <td className="px-4 py-3">{bill.bill_date}</td>
                <td className="px-4 py-3 text-right">{formatINR(Number(bill.total_amount))}</td>
                <td className="px-4 py-3"><Badge>{bill.status}</Badge></td>
              </tr>
            ))}
            {bills.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No bills yet</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="mb-3 text-lg font-semibold">Recent Imports</h2>
      <div className="space-y-2">
        {imports.map((imp) => (
          <div key={imp.id} className="rounded border px-4 py-2 text-sm">
            {imp.file_name} — <Badge variant="secondary">{imp.status}</Badge>
          </div>
        ))}
        {imports.length === 0 && <p className="text-muted-foreground">No imports yet</p>}
      </div>
    </div>
  );
}
