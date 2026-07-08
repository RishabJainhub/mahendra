'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { BillPrintModal } from '@/components/pdf/bill-print-modal';
import { Printer } from 'lucide-react';

type Props = { billId: string };

export function ReprintButton({ billId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} variant="outline">
        <Printer className="mr-1.5 h-4 w-4" />
        Print
      </Button>
    );
  }

  return (
    <BillPrintModal
      billId={billId}
      onClose={() => setOpen(false)}
      onMarked={() => router.refresh()}
    />
  );
}
