'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { recomputeBillPricing, cancelBill, deleteBill } from '@/app/actions/bills';
import { ActionMenu } from '@/components/ui/action-menu';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { RefreshCw, Ban, Trash2 } from 'lucide-react';

type Props = {
  billId: string;
  billNumber: string;
  status: string;
};

/**
 * Secondary actions for the bill header, folded into a "⋯" menu so the
 * primary actions (Print, Edit) stay prominent.
 */
export function BillActionsMenu({ billId, billNumber, status }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [confirm, setConfirm] = useState<'cancel' | 'delete' | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleRefreshPricing() {
    setBusy(true);
    const result = await recomputeBillPricing(billId);
    setBusy(false);
    if (result.ok) {
      const hsnNote = result.data.hsnUpdated > 0 ? ` and filled ${result.data.hsnUpdated} HSN` : '';
      toast({
        title: 'Pricing recomputed',
        description: `Updated ${result.data.updated} line items${hsnNote}.`,
        variant: 'success',
      });
      router.refresh();
    } else {
      toast({ title: 'Recompute failed', description: result.error, variant: 'destructive' });
    }
  }

  async function handleConfirm() {
    if (!confirm) return;
    setBusy(true);
    const result = confirm === 'cancel' ? await cancelBill(billId) : await deleteBill(billId);
    setBusy(false);
    setConfirm(null);
    if (result.ok) {
      if (confirm === 'delete') {
        router.push('/admin/bills');
      }
      toast({
        title: confirm === 'cancel' ? 'Bill cancelled' : 'Bill deleted',
        description: `Bill ${billNumber}`,
        variant: 'success',
      });
      router.refresh();
    } else {
      toast({
        title: confirm === 'cancel' ? 'Cancel failed' : 'Delete failed',
        description: result.error,
        variant: 'destructive',
      });
    }
  }

  const items = [
    ...(status !== 'cancelled'
      ? [
          {
            label: 'Cancel bill',
            icon: <Ban className="h-4 w-4" />,
            onSelect: () => setConfirm('cancel'),
            destructive: true,
          },
        ]
      : []),
    {
      label: 'Delete bill',
      icon: <Trash2 className="h-4 w-4" />,
      onSelect: () => setConfirm('delete'),
      destructive: true,
    },
  ];

  return (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        onClick={() => void handleRefreshPricing()}
      >
        <RefreshCw className={`mr-1.5 h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
        {busy ? 'Recomputing…' : 'Recompute Pricing'}
      </Button>
      <ActionMenu items={items} size="default" label="More bill actions" />

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold">
              {confirm === 'cancel' ? 'Cancel this bill?' : 'Delete this bill?'}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {confirm === 'cancel'
                ? `Bill ${billNumber} will be marked cancelled and excluded from totals. You can still view it.`
                : `Bill ${billNumber} and all its line items will be permanently removed. This can't be undone.`}
            </p>
            <div className="mt-4 flex gap-2">
              <Button variant="destructive" disabled={busy} onClick={() => void handleConfirm()}>
                {busy ? 'Working…' : confirm === 'cancel' ? 'Cancel bill' : 'Delete bill'}
              </Button>
              <Button variant="outline" disabled={busy} onClick={() => setConfirm(null)}>
                Keep bill
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
