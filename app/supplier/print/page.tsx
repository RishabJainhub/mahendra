import { getBills } from '@/app/actions/bills';
import { getDefaultLayout } from '@/app/actions/supplier';
import { requireSupplier } from '@/lib/auth';
import { PrintPageClient } from './print-client';

export default async function SupplierPrintPage() {
  await requireSupplier();
  const { bills } = await getBills({ status: 'imported' });
  const layout = await getDefaultLayout();

  return <PrintPageClient bills={bills} layout={layout} />;
}
