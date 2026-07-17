'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteBill } from '@/app/actions/bills';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';

type Props = {
  billId: string;
  billNumber: string;
  redirectTo?: string;
  variant?: 'default' | 'destructive' | 'outline' | 'ghost' | 'secondary';
  className?: string;
  label?: string;
  /** Admin delete hides from admin only; supplier delete hides from supplier only. */
  adminOnly?: boolean;
  /** Supplier delete hides from supplier only; admin keeps access. */
  supplierOnly?: boolean;
};

export function DeleteBillButton({
  billId,
  billNumber,
  redirectTo,
  variant = 'destructive',
  className,
  label = 'Delete',
  adminOnly = false,
  supplierOnly = false,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function handleConfirm() {
    startTransition(async () => {
      const result = await deleteBill(billId);
      if (!result.ok) {
        toast({
          title: 'Delete failed',
          description: result.error ?? 'Could not delete bill',
          variant: 'destructive',
        });
        setConfirming(false);
        return;
      }

      setConfirming(false);
      toast({
        title: adminOnly
          ? 'Removed from admin'
          : supplierOnly
            ? 'Removed from your portal'
            : 'Bill removed',
        description: `Bill ${billNumber}`,
        variant: 'success',
      });

      if (redirectTo) {
        router.replace(redirectTo);
      }
      router.refresh();
    });
  }

  if (!confirming) {
    return (
      <Button
        type="button"
        variant={variant}
        className={className}
        onClick={() => setConfirming(true)}
      >
        {label}
      </Button>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">
        {adminOnly
          ? `Remove bill ${billNumber} from admin only? The supplier keeps access.`
          : supplierOnly
            ? `Remove bill ${billNumber} from your portal only? Admin still keeps access.`
            : `Remove bill ${billNumber}?`}
      </span>
      <Button type="button" variant="destructive" disabled={pending} onClick={handleConfirm}>
        {pending ? 'Deleting…' : 'Confirm'}
      </Button>
      <Button type="button" variant="outline" disabled={pending} onClick={() => setConfirming(false)}>
        Cancel
      </Button>
    </span>
  );
}
