import { requireSupplier } from '@/lib/auth';
import { getSupplierDashboard } from '@/app/actions/supplier';
import { formatINR, formatSupplierCode } from '@/lib/pricing';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader, PageShell } from '@/components/layout/page-header';
import { EmptyState } from '@/components/layout/empty-state';
import { ButtonLink } from '@/components/ui/button-link';
import { BillStatusBadge } from '@/components/bills/bill-status-badge';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { FileInput, Receipt, Printer, Clock, Tag, FileText } from 'lucide-react';

export default async function SupplierDashboardPage() {
  const user = await requireSupplier();
  const { bills, totalBills, printedBills, lastImport, imports } = await getSupplierDashboard();

  const supplierCode = formatSupplierCode(user.supplier?.code_prefix, user.supplier?.code_number);

  const kpis = [
    { label: 'Total Bills', value: String(totalBills), icon: Receipt },
    { label: 'Stickers Printed', value: String(printedBills), icon: Printer },
    {
      label: 'Last Import',
      value: lastImport?.created_at
        ? new Date(lastImport.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
        : '—',
      icon: Clock,
    },
    { label: 'Supplier Code', value: supplierCode || '—', icon: Tag },
  ];

  return (
    <PageShell>
      <PageHeader title={`Welcome, ${user.supplier?.name}`} description="Your Tally bill import and barcode printing hub.">
        <ButtonLink href="/supplier/import" variant="default">
          <FileInput className="mr-1.5 h-4 w-4" />
          Import Tally Bill
        </ButtonLink>
        <ButtonLink href="/supplier/print" variant="outline">
          <Printer className="mr-1.5 h-4 w-4" />
          Print Barcodes
        </ButtonLink>
        <ButtonLink href="/supplier/bills/manual" variant="outline">
          <FileText className="mr-1.5 h-4 w-4" />
          Manual Entry
        </ButtonLink>
      </PageHeader>

      <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.label}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpi.value}</div>
              </CardContent>
            </Card>
          );
        })}
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
          <Table>
            <THead>
              <TR>
                <TH>Bill #</TH>
                <TH>Date</TH>
                <TH align="right">Total</TH>
                <TH>Status</TH>
                <TH align="right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {bills.map((bill) => (
                <TR key={bill.id}>
                  <TD className="font-medium">
                    <a href={`/supplier/bills/${bill.id}`} className="text-primary hover:underline">
                      {bill.bill_number}
                    </a>
                  </TD>
                  <TD>{bill.bill_date}</TD>
                  <TD align="right">{formatINR(Number(bill.total_amount))}</TD>
                  <TD><BillStatusBadge status={bill.status} /></TD>
                  <TD align="right">
                    <ButtonLink href={`/supplier/print?billId=${bill.id}`} variant="ghost" size="sm">
                      Print
                    </ButtonLink>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
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
