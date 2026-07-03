import { notFound } from 'next/navigation';
import { getSupplierBill } from '@/app/actions/bills';
import { formatINR } from '@/lib/pricing';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ButtonLink } from '@/components/ui/button-link';
import { DeleteBillButton } from '@/components/bills/delete-bill-button';
import { BillStatusBadge } from '@/components/bills/bill-status-badge';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { PageHeader, PageShell } from '@/components/layout/page-header';
import { requireSupplier } from '@/lib/auth';
import { ArrowLeft, Printer, ListChecks } from 'lucide-react';

type Props = { params: Promise<{ id: string }> };

export default async function SupplierBillDetailPage({ params }: Props) {
  await requireSupplier();
  const { id } = await params;
  const bill = await getSupplierBill(id);
  if (!bill) notFound();

  const items = bill.bill_items ?? [];

  return (
    <PageShell>
      <PageHeader
        title={`Bill ${bill.bill_number}`}
        description={`${(bill.supplier as { name: string })?.name} · ${bill.bill_date}`}
      >
        <ButtonLink href="/supplier/bills" variant="ghost">
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back to Bills
        </ButtonLink>
        <ButtonLink href={`/supplier/print?billId=${id}`} variant="default">
          <Printer className="mr-1.5 h-4 w-4" />
          Print Barcodes
        </ButtonLink>
        <DeleteBillButton billId={id} billNumber={bill.bill_number} redirectTo="/supplier/bills" />
      </PageHeader>

      <div className="mb-6 flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Status:</span>
        <BillStatusBadge status={bill.status} />
        <span className="ml-4 text-lg font-semibold">{formatINR(Number(bill.total_amount))}</span>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <ListChecks className="h-4 w-4 text-muted-foreground" />
            Line items
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
              {items.length}
            </span>
          </CardTitle>
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
                {items.map(
                  (item: {
                    id: string;
                    sku: string;
                    name: string;
                    hsn: string | null;
                    qty: number;
                    rate: number;
                    ma_price: number | string | null;
                    dna_price: number | string | null;
                    total: number;
                  }) => (
                    <TR key={item.id}>
                      <TD className="font-mono text-xs">{item.sku}</TD>
                      <TD>{item.name}</TD>
                      <TD className="text-muted-foreground">{item.hsn ?? '—'}</TD>
                      <TD align="right">{item.qty}</TD>
                      <TD align="right">{formatINR(Number(item.rate))}</TD>
                      <TD align="right">{formatINR(Number(item.ma_price ?? 0))}</TD>
                      <TD align="right">{formatINR(Number(item.dna_price ?? 0))}</TD>
                      <TD align="right" className="font-medium">{formatINR(Number(item.total))}</TD>
                    </TR>
                  )
                )}
              </TBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
