import { getBills } from '@/app/actions/bills';
import { getLayouts } from '@/app/actions/layouts';
import { PrintClient } from './PrintClient';

export default async function AdminPrintPage() {
  const { bills } = await getBills({ status: 'imported' });
  const layouts = await getLayouts();
  return <PrintClient bills={bills} layouts={layouts} />;
}
