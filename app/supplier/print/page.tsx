import { getBills } from '@/app/actions/bills';
import { getDefaultLayout } from '@/app/actions/supplier';
import { requireSupplier } from '@/lib/auth';
import { PrintPageClient } from './print-client';

export default async function SupplierPrintPage() {
  await requireSupplier();
  const { bills } = await getBills({ pageSize: 100 });
  const printable = (bills as { id: string; bill_number: string; bill_date: string; status: string }[])
    .filter((b) => b.status === 'imported' || b.status === 'printed');
  const layout = await getDefaultLayout();

  return <PrintPageClient bills={printable} layout={layout} />;
}
