import { requireAdmin } from '@/lib/auth';
import { getSuppliers } from '@/app/actions/suppliers';
import { ManualBillForm } from './client-page';
import { PageHeader, PageShell } from '@/components/layout/page-header';

export default async function ManualBillPage() {
  await requireAdmin();
  const suppliers = await getSuppliers();

  return (
    <PageShell>
      <PageHeader
        title="Manual bill entry"
        description="Type in a physical bill's items by hand. MA/DNA prices are computed automatically on save."
      />
      <ManualBillForm suppliers={suppliers} />
    </PageShell>
  );
}
