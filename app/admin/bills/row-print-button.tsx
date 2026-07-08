'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { BillPrintModal } from '@/components/pdf/bill-print-modal';
import { Printer } from 'lucide-react';

type Props = { billId: string };

/** Printer icon on each bills-list row — opens the print modal in place. */
export function RowPrintButton({ billId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 px-2"
        title="Print labels"
        onClick={() => setOpen(true)}
      >
        <Printer className="h-4 w-4" />
      </Button>
      {open && (
        <BillPrintModal
          billId={billId}
          onClose={() => setOpen(false)}
          onMarked={() => router.refresh()}
        />
      )}
    </>
  );
}
