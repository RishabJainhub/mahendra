import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSupplierAdminDashboard } from '@/app/actions/suppliers';
import { formatINR, describeFormula, formatModelLabel, type PricingModel } from '@/lib/pricing';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader, PageShell } from '@/components/layout/page-header';
import { EmptyState } from '@/components/layout/empty-state';
import { FileInput, Receipt } from 'lucide-react';

type Props = { params: Promise<{ id: string }> };

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'outline',
  imported: 'secondary',
  printed: 'default',
  cancelled: 'destructive',
};

export default async function AdminSupplierDashboardPage({ params }: Props) {
  const { id } = await params;
  const data = await getSupplierAdminDashboard(id);
  if (!data) notFound();

  const { supplier, bills, imports, totalBills, printedBills, totalValue } = data;
  const pricingRule = Array.isArray(supplier.pricing_rule)
    ? supplier.pricing_rule[0]
    : supplier.pricing_rule;

  const formula = pricingRule
    ? describeFormula({
        model: pricingRule.model as PricingModel,
        margin_pct: Number(pricingRule.margin_pct),
        markup_pct: Number(pricingRule.markup_pct),
        gst_pct: Number(pricingRule.gst_pct),
      })
    : 'No formula assigned';

  const kpis = [
    { label: 'Total Bills', value: String(totalBills) },
    { label: 'Printed Bills', value: String(printedBills) },
    { label: 'Total Value', value: formatINR(totalValue) },
    { label: 'Formula', value: pricingRule ? formatModelLabel(pricingRule.model) : '—' },
  ];

  return (
    <PageShell>
      <PageHeader
        title={`${supplier.name} Dashboard`}
        description="Admin view of this supplier's formula, bills, imports, and print readiness."
      >
        <Link
          href="/admin/suppliers"
          className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-medium hover:bg-accent"
        >
          Back to Suppliers
        </Link>
        <Link
          href={`/admin/bills?supplier=${supplier.id}`}
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          View Bills
        </Link>
      </PageHeader>

      <div className="mb-6 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
        <span className="font-semibold text-primary">Active formula: </span>
        <span>{formula}</span>
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

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section>
          <h2 className="mb-3 text-lg font-semibold">Recent Bills</h2>
          {bills.length === 0 ? (
            <EmptyState
              icon={<Receipt className="h-10 w-10" />}
              title="No bills yet"
              description="Once this supplier imports a Tally bill, it will appear here."
            />
          ) : (
            <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left">Bill #</th>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-right">Items</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map((bill) => (
                    <tr key={bill.id} className="border-t hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium">{bill.bill_number}</td>
                      <td className="px-4 py-3">{bill.bill_date}</td>
                      <td className="px-4 py-3 text-right">
                        {(bill.bill_items as { count: number }[])?.[0]?.count ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right">{formatINR(Number(bill.total_amount))}</td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_VARIANT[bill.status] ?? 'outline'}>{bill.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/admin/bills/${bill.id}`} className="text-primary hover:underline">
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">Recent Imports</h2>
          {imports.length === 0 ? (
            <EmptyState
              icon={<FileInput className="h-10 w-10" />}
              title="No imports"
              description="Imported Tally files will be listed here."
            />
          ) : (
            <div className="space-y-2">
              {imports.map((item) => (
                <div key={item.id} className="rounded-lg border bg-card px-4 py-3 text-sm">
                  <div className="font-medium">{item.file_name}</div>
                  <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{item.file_type}</span>
                    <Badge variant="secondary">{item.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </PageShell>
  );
}
