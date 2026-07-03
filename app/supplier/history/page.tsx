import { redirect } from 'next/navigation';

type Props = {
  searchParams: Promise<{ status?: string; from?: string; to?: string; page?: string }>;
};

export default async function SupplierHistoryRedirect({ searchParams }: Props) {
  const params = await searchParams;
  const q = new URLSearchParams();
  if (params.status) q.set('status', params.status);
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  if (params.page) q.set('page', params.page);
  const qs = q.toString();
  redirect(`/supplier/bills${qs ? `?${qs}` : ''}`);
}
