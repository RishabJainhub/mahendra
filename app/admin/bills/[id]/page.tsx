import { notFound } from 'next/navigation';
import { getBill } from '@/app/actions/bills';
import { formatINR } from '@/lib/pricing';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, THead, TBody, TR, TH, TD, TFoot } from '@/components/ui/table';
import { PageHeader, PageShell } from '@/components/layout/page-header';
import { ButtonLink } from '@/components/ui/button-link';
import { BillStatusBadge } from '@/components/bills/bill-status-badge';
import { ReprintButton } from './reprint-button';
import { BillActionsMenu } from './bill-actions-menu';
import { requireAdmin } from '@/lib/auth';
import { ArrowLeft, Pencil, ClipboardList, IndianRupee } from 'lucide-react';

/** Friendly labels for raw audit-trail action names. */
const AUDIT_LABELS: Record<string, string> = {
  import: 'Imported',
  manual_edit: 'Edited manually',
  manual_create: 'Created manually',
  recompute_pricing: 'Pricing recomputed',
  print: 'Printed',
  cancel: 'Cancelled',
  delete: 'Deleted',
  create: 'Created',
};

type Props = { params: Promise<{ id: string }> };

export default async function AdminBillDetailPage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;
  const bill = await getBill(id);
  if (!bill) notFound();

  const items = (bill.bill_items ?? []) as {
    id: string;
    sku: string;
    name: string;
    hsn: string | null;
    qty: number;
    rate: number;
    ma_price: number | string | null;
    dna_price: number | string | null;
    total: number;
  }[];
  const itemsTotal = items.reduce((sum, i) => sum + Number(i.total), 0);

  return (
    <PageShell>
      <PageHeader
        title={`Bill ${bill.bill_number}`}
        description={`${(bill.supplier as { name: string })?.name} · ${bill.bill_date}`}
      >
        <ButtonLink href="/admin/bills" variant="ghost">
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back to Bills
        </ButtonLink>
        <ButtonLink href={`/admin/bills/${id}/edit`} variant="outline">
          <Pencil className="mr-1.5 h-4 w-4" />
          Edit
        </ButtonLink>
        <ReprintButton billId={id} />
        <BillActionsMenu billId={id} billNumber={bill.bill_number} status={bill.status} />
      </PageHeader>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground">Status</span>
        <BillStatusBadge status={bill.status} />
        <span className="ml-4 flex items-center gap-1.5 text-lg font-semibold">
          <IndianRupee className="h-4 w-4 text-muted-foreground" />
          {formatINR(Number(bill.total_amount))}
        </span>
      </div>

      <Card className="mb-8">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Line items</CardTitle>
          <CardDescription>{items.length} item{items.length !== 1 ? 's' : ''} on this bill.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>SKU</TH>
                  <TH>Name</TH>
                  <TH>HSN</TH>
                  <TH align="right">Qty</TH>
                  <TH align="right">Rate</TH>
                  <TH align="right">MA</TH>
                  <TH align="right">DNA</TH>
                  <TH align="right">Total</TH>
                </TR>
              </THead>
              <TBody>
                {items.map((item) => (
                    <TR key={item.id}>
                      <TD className="font-mono text-xs">{item.sku}</TD>
                      <TD className="font-medium">{item.name}</TD>
                      <TD className="font-mono text-xs text-muted-foreground">{item.hsn ?? '—'}</TD>
                      <TD align="right" className="tabular-nums">{item.qty}</TD>
                      <TD align="right" className="tabular-nums">{formatINR(Number(item.rate))}</TD>
                      <TD align="right" className="tabular-nums">{formatINR(Number(item.ma_price ?? 0))}</TD>
                      <TD align="right" className="tabular-nums">{formatINR(Number(item.dna_price ?? 0))}</TD>
                      <TD align="right" className="tabular-nums font-medium">{formatINR(Number(item.total))}</TD>
                    </TR>
                  )
                )}
              </TBody>
              {items.length > 0 && (
                <TFoot>
                  <TR>
                    <TD colSpan={7} align="right" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Subtotal
                    </TD>
                    <TD align="right" className="text-base font-semibold tabular-nums">
                      {formatINR(itemsTotal)}
                    </TD>
                  </TR>
                </TFoot>
              )}
            </Table>
          </div>
        </CardContent>
      </Card>

      {bill.audit && bill.audit.length > 0 && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
              Audit trail
            </CardTitle>
            <CardDescription>Record of every action taken on this bill.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {bill.audit.map((entry: { id: string; action: string; created_at: string }) => (
              <div key={entry.id} className="flex items-center justify-between rounded-md border bg-muted/20 px-4 py-2 text-sm">
                <span className="font-medium">{AUDIT_LABELS[entry.action] ?? entry.action}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(entry.created_at).toLocaleString('en-IN')}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
}
