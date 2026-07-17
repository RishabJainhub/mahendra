'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteBill } from '@/app/actions/bills';
import { Button } from '@/components/ui/button';

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
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function handleConfirm() {
    startTransition(async () => {
      const result = await deleteBill(billId);
      if (!result.ok) {
        alert(result.error ?? 'Could not delete bill');
        setConfirming(false);
        return;
      }
      setConfirming(false);
      if (redirectTo) {
        router.push(redirectTo);
      } else {
        router.refresh();
      }
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
    <span className={className ?? 'inline-flex items-center gap-2'}>
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
