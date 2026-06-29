import { getLayouts } from '@/app/actions/layouts';
import { PrintClient } from './PrintClient';
import { todayIst } from '@/lib/tally/dates';

export default async function AdminPrintPage() {
  const layouts = await getLayouts();
  return <PrintClient layouts={layouts} initialDate={todayIst()} bulkPrintEnabled />;
}
