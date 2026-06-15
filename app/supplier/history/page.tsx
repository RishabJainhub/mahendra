import { Suspense } from 'react';
import Link from 'next/link';
import { requireSupplier } from '@/lib/auth';
import { getBills } from '@/app/actions/bills';
import { formatINR } from '@/lib/pricing';
import { Badge } from '@/components/ui/badge';
import { HistoryFilters } from './history-filters';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'outline',
  imported: 'secondary',
  printed: 'default',
  cancelled: 'destructive',
};

type Props = {
  searchParams: Promise<{ status?: string; from?: string; to?: string; page?: string }>;
};

export default async function SupplierHistoryPage({ searchParams }: Props) {
  const user = await requireSupplier();
  const params = await searchParams;
  const page = Number(params.page ?? 1);

  const { bills, total } = await getBills({
    status: params.status,
    from: params.from,
    to: params.to,
    page,
    pageSize: 20,
  });

  const totalPages = Math.ceil(total / 20);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Bill History</h1>
      <Suspense fallback={<div className="mb-6 h-10" />}>
        <HistoryFilters />
      </Suspense>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left">Bill #</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Supplier</th>
              <th className="px-4 py-3 text-right">Items</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left"></th>
            </tr>
          </thead>
          <tbody>
            {bills.map((bill) => (
              <tr key={bill.id} className="border-t">
                <td className="px-4 py-3">{bill.bill_number}</td>
                <td className="px-4 py-3">{bill.bill_date}</td>
                <td className="px-4 py-3">{user.supplier?.name}</td>
                <td className="px-4 py-3 text-right">
                  {(bill.bill_items as { count: number }[])?.[0]?.count ?? '—'}
                </td>
                <td className="px-4 py-3 text-right">{formatINR(Number(bill.total_amount))}</td>
                <td className="px-4 py-3">
                  <Badge variant={STATUS_VARIANT[bill.status] ?? 'outline'}>{bill.status}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Link href="/supplier/print" className="text-primary hover:underline">View</Link>
                </td>
              </tr>
            ))}
            {bills.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No bills found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex gap-2">
          {page > 1 && (
            <Link href={`/supplier/history?page=${page - 1}`} className="text-sm text-primary hover:underline">← Prev</Link>
          )}
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          {page < totalPages && (
            <Link href={`/supplier/history?page=${page + 1}`} className="text-sm text-primary hover:underline">Next →</Link>
          )}
        </div>
      )}
    </div>
  );
}
