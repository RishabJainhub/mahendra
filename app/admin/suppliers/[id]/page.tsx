import { notFound } from 'next/navigation';
import { getSupplierAdminDashboard } from '@/app/actions/suppliers';
import { formatINR, describeFormula, formatSupplierCode } from '@/lib/pricing';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { PageHeader, PageShell } from '@/components/layout/page-header';
import { ButtonLink } from '@/components/ui/button-link';
import { EmptyState } from '@/components/layout/empty-state';
import { BillStatusBadge } from '@/components/bills/bill-status-badge';
import { FileInput, Receipt, ArrowLeft, FileText, IndianRupee, Hash, Tag } from 'lucide-react';
import Link from 'next/link';

type Props = { params: Promise<{ id: string }> };

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
        ma_markup1_pct: Number(pricingRule.ma_markup1_pct) || 0,
        ma_markup2_pct: Number(pricingRule.ma_markup2_pct) || 0,
        dna_markup1_pct: Number(pricingRule.dna_markup1_pct) || 0,
        dna_markup2_pct: Number(pricingRule.dna_markup2_pct) || 0,
        gst_pct: Number(pricingRule.gst_pct) || 0,
      })
    : 'No formula assigned';

  const supplierCode = formatSupplierCode(supplier.code_prefix, supplier.code_number);

  const kpis = [
    { label: 'Total bills', value: String(totalBills), icon: <Receipt className="h-4 w-4" /> },
    { label: 'Printed bills', value: String(printedBills), icon: <FileText className="h-4 w-4" /> },
    { label: 'Total value', value: formatINR(totalValue), icon: <IndianRupee className="h-4 w-4" /> },
    { label: 'Supplier code', value: supplierCode || '—', icon: <Hash className="h-4 w-4" /> },
  ];

  return (
    <PageShell>
      <PageHeader
        title={`${supplier.name} dashboard`}
        description="Admin view of this supplier's formula, bills, imports, and print readiness."
      >
        <ButtonLink href="/admin/suppliers" variant="ghost">
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back to suppliers
        </ButtonLink>
        <ButtonLink href={`/admin/bills?supplier=${supplier.id}`} variant="outline">
          <Tag className="mr-1.5 h-4 w-4" />
          View bills
        </ButtonLink>
      </PageHeader>

      <div className="mb-6 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
        <span className="font-semibold text-primary">Active formula: </span>
        <span>{formula}</span>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section>
          <h2 className="mb-3 text-lg font-semibold">Recent bills</h2>
          {bills.length === 0 ? (
            <EmptyState
              icon={<Receipt className="h-10 w-10" />}
              title="No bills yet"
              description="Once this supplier imports a Tally bill, it will appear here."
            />
          ) : (
            <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
              <Table>
                <THead>
                  <TR>
                    <TH>Bill #</TH>
                    <TH>Date</TH>
                    <TH align="right">Items</TH>
                    <TH align="right">Total</TH>
                    <TH>Status</TH>
                    <TH align="right">Action</TH>
                  </TR>
                </THead>
                <TBody>
                  {bills.map((bill) => (
                    <TR key={bill.id}>
                      <TD className="font-medium">{bill.bill_number}</TD>
                      <TD>{bill.bill_date}</TD>
                      <TD align="right" className="tabular-nums">
                        {(bill.bill_items as { count: number }[])?.[0]?.count ?? '—'}
                      </TD>
                      <TD align="right" className="tabular-nums">{formatINR(Number(bill.total_amount))}</TD>
                      <TD><BillStatusBadge status={bill.status} /></TD>
                      <TD align="right">
                        <Link href={`/admin/bills/${bill.id}`} className="text-primary hover:underline">
                          Open
                        </Link>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">Recent imports</h2>
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
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">{item.status}</span>
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
