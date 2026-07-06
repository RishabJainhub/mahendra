import { getSupplierMappings } from '@/app/actions/supplier';
import { requireSupplier } from '@/lib/auth';
import { ImportForm } from './import-form';
import { PageHeader, PageShell } from '@/components/layout/page-header';
import { ButtonLink } from '@/components/ui/button-link';
import { FileText } from 'lucide-react';

export default async function SupplierImportPage() {
  const [mappings, user] = await Promise.all([
    getSupplierMappings(),
    requireSupplier(),
  ]);
  return (
    <PageShell>
      <PageHeader
        title="Import Bill"
        description="Upload a PDF, XML, Excel, or CSV file from any accounting software."
      >
        <ButtonLink href="/supplier/bills/manual" variant="outline">
          <FileText className="mr-1.5 h-4 w-4" />
          Enter manually
        </ButtonLink>
      </PageHeader>
      <ImportForm mappings={mappings} supplierId={user.supplier_id!} />
    </PageShell>
  );
}
