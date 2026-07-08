import { getBills } from '@/app/actions/bills';
import { getSuppliers } from '@/app/actions/suppliers';
import { formatINR } from '@/lib/pricing';
import { PageHeader, PageShell } from '@/components/layout/page-header';
import { ButtonLink } from '@/components/ui/button-link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { EmptyState } from '@/components/layout/empty-state';
import { BillStatusBadge } from '@/components/bills/bill-status-badge';
import { DeleteBillButton } from './[id]/delete-button';
import { RowPrintButton } from './row-print-button';
import { FileText, Filter, X, Receipt } from 'lucide-react';
import Link from 'next/link';

const PAGE_SIZE = 25;

type Props = {
  searchParams: Promise<{ status?: string; supplier?: string; from?: string; to?: string; q?: string; page?: string }>;
};

function buildPageUrl(page: number, params: { status?: string; supplier?: string; from?: string; to?: string; q?: string }) {
  const q = new URLSearchParams();
  if (params.status) q.set('status', params.status);
  if (params.supplier) q.set('supplier', params.supplier);
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  if (params.q) q.set('q', params.q);
  if (page > 1) q.set('page', String(page));
  const qs = q.toString();
  return `/admin/bills${qs ? `?${qs}` : ''}`;
}

export default async function AdminBillsPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1));
  const { bills, total } = await getBills({
    status: params.status,
    supplierId: params.supplier,
    from: params.from,
    to: params.to,
    search: params.q,
    page,
    pageSize: PAGE_SIZE,
  });
  const suppliers = await getSuppliers();
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(params.status || params.supplier || params.from || params.to || params.q);

  return (
    <PageShell>
      <PageHeader title="Bills" description="All bills across every supplier. Filter, review, or correct entries.">
        <ButtonLink href="/admin/bills/manual" variant="outline">
          <FileText className="mr-1.5 h-4 w-4" />
          Manual entry
        </ButtonLink>
      </PageHeader>

      <form className="mb-6 flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label htmlFor="q" className="text-xs font-medium text-muted-foreground">Bill #</label>
          <Input name="q" defaultValue={params.q ?? ''} placeholder="Search bill number" className="w-44" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="status" className="text-xs font-medium text-muted-foreground">Status</label>
          <Select name="status" defaultValue={params.status ?? ''} className="w-44">
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="imported">Imported</option>
            <option value="printed">Printed</option>
            <option value="cancelled">Cancelled</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="supplier" className="text-xs font-medium text-muted-foreground">Supplier</label>
          <Select name="supplier" defaultValue={params.supplier ?? ''} className="w-48">
            <option value="">All suppliers</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="from" className="text-xs font-medium text-muted-foreground">From</label>
          <Input type="date" name="from" defaultValue={params.from ?? ''} className="w-40" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="to" className="text-xs font-medium text-muted-foreground">To</label>
          <Input type="date" name="to" defaultValue={params.to ?? ''} className="w-40" />
        </div>
        <Button type="submit">
          <Filter className="mr-1.5 h-4 w-4" />
          Filter
        </Button>
        {hasFilters && (
          <ButtonLink href="/admin/bills" variant="ghost">
            <X className="mr-1.5 h-4 w-4" />
            Clear
          </ButtonLink>
        )}
      </form>

      {bills.length === 0 ? (
        <EmptyState
          icon={<Receipt className="h-10 w-10" />}
          title="No bills found"
          description={hasFilters ? 'Try adjusting or clearing the filters.' : 'Bills will appear here once a supplier imports or you enter one manually.'}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <THead>
              <TR>
                <TH>Bill #</TH>
                <TH>Date</TH>
                <TH>Supplier</TH>
                <TH align="right">Total</TH>
                <TH>Status</TH>
                <TH align="right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {bills.map((bill) => (
                <TR key={bill.id}>
                  <TD>
                    <Link href={`/admin/bills/${bill.id}`} className="text-primary hover:underline">
                      {bill.bill_number}
                    </Link>
                  </TD>
                  <TD>{bill.bill_date}</TD>
                  <TD>{(bill.supplier as { name: string })?.name}</TD>
                  <TD align="right" className="tabular-nums">{formatINR(Number(bill.total_amount))}</TD>
                  <TD><BillStatusBadge status={bill.status} /></TD>
                  <TD align="right">
                    <div className="flex items-center justify-end gap-1">
                      {bill.status !== 'cancelled' && <RowPrintButton billId={bill.id} />}
                      <DeleteBillButton
                        billId={bill.id}
                        billNumber={bill.bill_number}
                        variant="ghost"
                        label="Delete"
                        className="h-8 px-2 text-destructive"
                      />
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center gap-2">
          {page > 1 && (
            <Link href={buildPageUrl(page - 1, params)} className="text-sm text-primary hover:underline">← Prev</Link>
          )}
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages} · {total} bills</span>
          {page < totalPages && (
            <Link href={buildPageUrl(page + 1, params)} className="text-sm text-primary hover:underline">Next →</Link>
          )}
        </div>
      )}
    </PageShell>
  );
}
