import Link from 'next/link';
import { getBills } from '@/app/actions/bills';
import { getSuppliers } from '@/app/actions/suppliers';
import { formatINR } from '@/lib/pricing';
import { Badge } from '@/components/ui/badge';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'outline',
  imported: 'secondary',
  printed: 'default',
  cancelled: 'destructive',
};

type Props = {
  searchParams: Promise<{ status?: string; supplier?: string; from?: string; to?: string }>;
};

export default async function AdminBillsPage({ searchParams }: Props) {
  const params = await searchParams;
  const { bills } = await getBills({
    status: params.status,
    supplierId: params.supplier,
    from: params.from,
    to: params.to,
  });
  const suppliers = await getSuppliers();

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
              </tr>
            ))}
            {bills.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No bills found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
