import Link from 'next/link';
import { requireSupplier } from '@/lib/auth';
import { getSupplierDashboard } from '@/app/actions/supplier';
import { formatINR, formatModelLabel, describeFormula } from '@/lib/pricing';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader, PageShell } from '@/components/layout/page-header';
import { EmptyState } from '@/components/layout/empty-state';
import { FileInput, Receipt } from 'lucide-react';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'outline',
  imported: 'secondary',
  printed: 'default',
  cancelled: 'destructive',
};

export default async function SupplierDashboardPage() {
  const user = await requireSupplier();
  const { bills, totalBills, printedBills, lastImport, pricingRule, imports } = await getSupplierDashboard();

  const formula = pricingRule
    ? describeFormula({
        model: pricingRule.model as 'standard' | 'company151',
        margin_pct: Number(pricingRule.margin_pct),
        markup_pct: Number(pricingRule.markup_pct),
        gst_pct: Number(pricingRule.gst_pct),
      })
    : 'Standard pricing';

  const kpis = [
    { label: 'Total Bills', value: String(totalBills) },
    { label: 'Stickers Printed', value: String(printedBills) },
    {
      label: 'Last Import',
      value: lastImport?.created_at
        ? new Date(lastImport.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
        : '—',
    },
    { label: 'Your Formula', value: pricingRule ? formatModelLabel(pricingRule.model) : '—' },
  ];

  return (
    <PageShell>
      <PageHeader title={`Welcome, ${user.supplier?.name}`} description="Your Tally bill import and barcode printing hub.">
        <Link
          href="/supplier/import"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Import Tally Bill
        </Link>
        <Link
          href="/supplier/print"
          className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-medium hover:bg-accent"
        >
          Print Barcodes
        </Link>
      </PageHeader>

      {pricingRule && (
        <div className="mb-6 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
          <span className="font-medium text-primary">Active formula: </span>
          <span className="text-foreground">{formula}</span>
        </div>
      )}

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
      {bills.length === 0 ? (
        <EmptyState
          icon={<Receipt className="h-10 w-10" />}
          title="No bills imported yet"
          description="Upload a Tally PDF, XML, or Excel file to create your first bill."
        />
      ) : (
        <div className="mb-8 overflow-hidden rounded-xl border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left">Bill #</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {bills.map((bill) => (
                <tr key={bill.id} className="border-t hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{bill.bill_number}</td>
                  <td className="px-4 py-3">{bill.bill_date}</td>
                  <td className="px-4 py-3 text-right">{formatINR(Number(bill.total_amount))}</td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[bill.status] ?? 'outline'}>{bill.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/supplier/print?billId=${bill.id}`} className="text-primary hover:underline">
                      Print
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mb-3 text-lg font-semibold">Recent Imports</h2>
      {imports.length === 0 ? (
        <EmptyState
          icon={<FileInput className="h-10 w-10" />}
          title="No imports yet"
          description="Your uploaded Tally files will appear here after each import."
        />
      ) : (
        <div className="space-y-2">
          {imports.map((imp) => (
            <div key={imp.id} className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 text-sm">
              <span>{imp.file_name}</span>
              <Badge variant="secondary">{imp.status}</Badge>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}
