import { getLayouts } from '@/app/actions/layouts';
import { PrintClient } from './PrintClient';
import { todayIst } from '@/lib/tally/dates';
import { PageShell } from '@/components/layout/page-header';

export default async function AdminPrintPage() {
  const layouts = await getLayouts();
  return (
    <PageShell>
      <PrintClient layouts={layouts} initialDate={todayIst()} bulkPrintEnabled />
    </PageShell>
  );
}
