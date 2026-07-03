import { Suspense } from 'react';
import { requireSupplier } from '@/lib/auth';
import { getBills } from '@/app/actions/bills';
import { formatINR } from '@/lib/pricing';
import { DeleteBillButton } from '@/components/bills/delete-bill-button';
import { BillStatusBadge } from '@/components/bills/bill-status-badge';
import { ButtonLink } from '@/components/ui/button-link';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { PageHeader, PageShell } from '@/components/layout/page-header';
import { EmptyState } from '@/components/layout/empty-state';
import { Receipt, Plus } from 'lucide-react';
import { BillsFilters } from './bills-filters';

const PAGE_SIZE = 25;

type Props = {
  searchParams: Promise<{ status?: string; from?: string; to?: string; page?: string }>;
};

function buildPageUrl(page: number, params: { status?: string; from?: string; to?: string }) {
  const q = new URLSearchParams();
  if (params.status) q.set('status', params.status);
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  if (page > 1) q.set('page', String(page));
  const qs = q.toString();
  return `/supplier/bills${qs ? `?${qs}` : ''}`;
}

export default async function SupplierBillsPage({ searchParams }: Props) {
  await requireSupplier();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1));

  const { bills, total } = await getBills({
    status: params.status,
    from: params.from,
    to: params.to,
    page,
    pageSize: PAGE_SIZE,
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(params.status || params.from || params.to);

  return (
    <PageShell>
      <PageHeader title="Bills" description="All bills you have imported or entered manually.">
        <ButtonLink href="/supplier/bills/manual">
          <Plus className="mr-1.5 h-4 w-4" />
          Manual entry
        </ButtonLink>
      </PageHeader>

      <Suspense fallback={<div className="mb-6 h-10" />}>
        <BillsFilters />
      </Suspense>

      {bills.length === 0 ? (
        <EmptyState
          icon={<Receipt className="h-10 w-10" />}
          title={hasFilters ? 'No bills match your filters' : 'No bills yet'}
          description={hasFilters ? 'Try clearing the filters to see all your bills.' : 'Import a Tally bill or enter one manually to get started.'}
          actionLabel={hasFilters ? 'Clear filters' : undefined}
          actionHref={hasFilters ? '/supplier/bills' : undefined}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
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
                    <span className="inline-flex items-center gap-3">
                      <ButtonLink href={`/supplier/print?billId=${bill.id}`} variant="ghost" size="sm">
                        Print
                      </ButtonLink>
                      <DeleteBillButton
                        billId={bill.id}
                        billNumber={bill.bill_number}
                        variant="ghost"
                        label="Delete"
                        className="h-8 px-2 text-destructive"
                      />
                    </span>
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
            <a href={buildPageUrl(page - 1, params)} className="text-sm text-primary hover:underline">← Prev</a>
          )}
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages} · {total} bills</span>
          {page < totalPages && (
            <a href={buildPageUrl(page + 1, params)} className="text-sm text-primary hover:underline">Next →</a>
          )}
        </div>
      )}
    </PageShell>
  );
}
