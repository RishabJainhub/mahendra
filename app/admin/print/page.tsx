import { getLayouts } from '@/app/actions/layouts';
import { PrintClient } from './PrintClient';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function AdminPrintPage() {
  const layouts = await getLayouts();
  return <PrintClient layouts={layouts} initialDate={todayIso()} bulkPrintEnabled />;
}
