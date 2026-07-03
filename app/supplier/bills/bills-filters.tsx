'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Filter } from 'lucide-react';

export function BillsFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const params = new URLSearchParams();
    const status = fd.get('status') as string;
    const from = fd.get('from') as string;
    const to = fd.get('to') as string;
    if (status) params.set('status', status);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    router.push(`/supplier/bills?${params.toString()}`);
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Status</label>
        <Select name="status" defaultValue={searchParams.get('status') ?? ''} className="w-40">
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="imported">Imported</option>
          <option value="printed">Printed</option>
          <option value="cancelled">Cancelled</option>
        </Select>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">From</label>
        <Input type="date" name="from" defaultValue={searchParams.get('from') ?? ''} className="w-40" />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">To</label>
        <Input type="date" name="to" defaultValue={searchParams.get('to') ?? ''} className="w-40" />
      </div>
      <Button type="submit" variant="default">
        <Filter className="mr-1.5 h-4 w-4" />
        Filter
      </Button>
    </form>
  );
}
