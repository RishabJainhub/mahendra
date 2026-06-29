import Link from 'next/link';
import { getBills } from '@/app/actions/bills';
import { getSuppliers } from '@/app/actions/suppliers';
import { formatINR } from '@/lib/pricing';
import { Badge } from '@/components/ui/badge';
import { DeleteBillButton } from './[id]/delete-button';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'outline',
  imported: 'secondary',
  printed: 'default',
  cancelled: 'destructive',
};

const PAGE_SIZE = 25;

type Props = {
  searchParams: Promise<{ status?: string; supplier?: string; from?: string; to?: string; page?: string }>;
};

function buildPageUrl(page: number, params: { status?: string; supplier?: string; from?: string; to?: string }) {
  const q = new URLSearchParams();
  if (params.status) q.set('status', params.status);
  if (params.supplier) q.set('supplier', params.supplier);
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
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
    page,
    pageSize: PAGE_SIZE,
  });
  const suppliers = await getSuppliers();
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Bills</h1>

      <form className="mb-6 flex flex-wrap gap-3">
        <select name="status" defaultValue={params.status ?? ''} className="h-10 rounded-md border px-3 text-sm">
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="imported">Imported</option>
          <option value="printed">Printed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select name="supplier" defaultValue={params.supplier ?? ''} className="h-10 rounded-md border px-3 text-sm">
          <option value="">All Suppliers</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <input type="date" name="from" defaultValue={params.from ?? ''} className="h-10 rounded-md border px-3 text-sm" />
        <input type="date" name="to" defaultValue={params.to ?? ''} className="h-10 rounded-md border px-3 text-sm" />
        <button type="submit" className="h-10 rounded-md bg-primary px-4 text-sm text-primary-foreground">Filter</button>
      </form>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left">Bill #</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Supplier</th>
              <th className="px-4 py-3 text-left">Total</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {bills.map((bill) => (
              <tr key={bill.id} className="border-t hover:bg-muted/30">
                <td className="px-4 py-3">
                  <Link href={`/admin/bills/${bill.id}`} className="text-primary hover:underline">
                    {bill.bill_number}
                  </Link>
                </td>
                <td className="px-4 py-3">{bill.bill_date}</td>
                <td className="px-4 py-3">{(bill.supplier as { name: string })?.name}</td>
                <td className="px-4 py-3">{formatINR(Number(bill.total_amount))}</td>
                <td className="px-4 py-3">
                  <Badge variant={STATUS_VARIANT[bill.status] ?? 'outline'}>{bill.status}</Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <DeleteBillButton
                    billId={bill.id}
                    billNumber={bill.bill_number}
                    variant="ghost"
                    label="Delete"
                    className="h-8 px-2 text-destructive"
                  />
                </td>
              </tr>
            ))}
            {bills.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No bills found</td></tr>
            )}
          </tbody>
        </table>
      </div>

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
    </div>
  );
}
