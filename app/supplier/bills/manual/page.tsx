import { requireSupplier } from '@/lib/auth';
import { ManualBillForm } from '@/components/bills/manual-bill-form';
import { PageHeader, PageShell } from '@/components/layout/page-header';
import { ButtonLink } from '@/components/ui/button-link';
import { ArrowLeft } from 'lucide-react';

export default async function SupplierManualBillPage() {
  const user = await requireSupplier();

  return (
    <PageShell>
      <PageHeader
        title="Manual bill entry"
        description="Type in a physical bill's items by hand. MA/DNA prices are computed automatically on save."
      >
        <ButtonLink href="/supplier/bills" variant="outline">
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back to Bills
        </ButtonLink>
      </PageHeader>
      <ManualBillForm
        fixedSupplierId={user.supplier_id!}
        billDetailBase="/supplier/bills/"
      />
    </PageShell>
  );
}
