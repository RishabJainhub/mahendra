import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { getSuppliers } from '@/app/actions/suppliers';
import { getBillForEdit } from '@/app/actions/bills';
import { PageHeader, PageShell } from '@/components/layout/page-header';
import { EditBillForm } from './client-page';

type Props = { params: Promise<{ id: string }> };

export default async function EditBillPage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;
  const [suppliers, bill] = await Promise.all([getSuppliers(), getBillForEdit(id)]);

  if (!bill) notFound();

  return (
    <PageShell>
      <PageHeader
        title="Edit bill"
        description="Fix mistakes from manual entry. MA/DNA prices are recomputed automatically on save."
      />
      <EditBillForm suppliers={suppliers} bill={bill} />
    </PageShell>
  );
}
