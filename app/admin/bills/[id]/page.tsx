import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getBill, cancelBillAction } from '@/app/actions/bills';
import { formatINR } from '@/lib/pricing';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ReprintButton } from './reprint-button';
import { requireAdmin } from '@/lib/auth';

type Props = { params: Promise<{ id: string }> };

export default async function AdminBillDetailPage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;
  const bill = await getBill(id);
  if (!bill) notFound();

  const items = bill.bill_items ?? [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/admin/bills" className="text-sm text-muted-foreground hover:underline">← Back to Bills</Link>
          <h1 className="text-2xl font-bold">Bill {bill.bill_number}</h1>
          <p className="text-muted-foreground">
            {(bill.supplier as { name: string })?.name} · {bill.bill_date}
          </p>
        </div>
        <div className="flex gap-2">
          <ReprintButton billId={id} />
          {bill.status !== 'cancelled' && (
            <form action={cancelBillAction.bind(null, id)}>
              <Button type="submit" variant="destructive">Cancel</Button>
            </form>
          )}
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Status:</span>
        <Badge>{bill.status}</Badge>
        <span className="ml-4 text-lg font-semibold">{formatINR(Number(bill.total_amount))}</span>
      </div>

      <div className="mb-8 overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left">SKU</th>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-right">Qty</th>
              <th className="px-4 py-3 text-right">Rate</th>
              <th className="px-4 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item: { id: string; sku: string; name: string; qty: number; rate: number; total: number }) => (
              <tr key={item.id} className="border-t">
                <td className="px-4 py-3">{item.sku}</td>
                <td className="px-4 py-3">{item.name}</td>
                <td className="px-4 py-3 text-right">{item.qty}</td>
                <td className="px-4 py-3 text-right">{formatINR(Number(item.rate))}</td>
                <td className="px-4 py-3 text-right">{formatINR(Number(item.total))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {bill.audit && bill.audit.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold">Audit Trail</h2>
          <div className="space-y-2">
            {bill.audit.map((entry: { id: string; action: string; created_at: string }) => (
              <div key={entry.id} className="rounded border px-4 py-2 text-sm">
                <span className="font-medium">{entry.action}</span>
                <span className="ml-2 text-muted-foreground">
                  {new Date(entry.created_at).toLocaleString('en-IN')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
