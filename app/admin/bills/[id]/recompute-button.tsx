'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { recomputeBillPricing } from '@/app/actions/bills';
import { Button } from '@/components/ui/button';

type Props = { billId: string };

export function RecomputeButton({ billId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    setMessage(null);
    const result = await recomputeBillPricing(billId);
    setLoading(false);
    if (result.ok) {
      const hsnNote = result.data.hsnUpdated > 0 ? ` · filled ${result.data.hsnUpdated} HSN` : '';
      setMessage(`Recomputed ${result.data.updated} line items${hsnNote}`);
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={handleClick} variant="outline" disabled={loading}>
        {loading ? 'Recomputing…' : 'Recompute MA/DNA + HSN'}
      </Button>
      {message && <span className="text-xs text-green-600">{message}</span>}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
