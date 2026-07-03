import { getLayouts } from '@/app/actions/layouts';
import { LayoutClient } from './LayoutClient';
import { PageShell } from '@/components/layout/page-header';

export default async function AdminLayoutsPage() {
  const layouts = await getLayouts();
  return (
    <PageShell>
      <LayoutClient layouts={layouts} />
    </PageShell>
  );
}
