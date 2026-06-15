'use client';

import { useRouter, useSearchParams } from 'next/navigation';

export function HistoryFilters() {
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
    router.push(`/supplier/history?${params.toString()}`);
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 flex flex-wrap gap-3">
      <select name="status" defaultValue={searchParams.get('status') ?? ''} className="h-10 rounded-md border px-3 text-sm">
        <option value="">All Statuses</option>
        <option value="draft">Draft</option>
        <option value="imported">Imported</option>
        <option value="printed">Printed</option>
        <option value="cancelled">Cancelled</option>
      </select>
      <input type="date" name="from" defaultValue={searchParams.get('from') ?? ''} className="h-10 rounded-md border px-3 text-sm" />
      <input type="date" name="to" defaultValue={searchParams.get('to') ?? ''} className="h-10 rounded-md border px-3 text-sm" />
      <button type="submit" className="h-10 rounded-md bg-primary px-4 text-sm text-primary-foreground">Filter</button>
    </form>
  );
}
