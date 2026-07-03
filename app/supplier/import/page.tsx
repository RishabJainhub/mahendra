import { getSupplierMappings } from '@/app/actions/supplier';
import { ImportForm } from './import-form';
import { PageHeader, PageShell } from '@/components/layout/page-header';
import { ButtonLink } from '@/components/ui/button-link';
import { FileText } from 'lucide-react';

export default async function SupplierImportPage() {
  const mappings = await getSupplierMappings();
  return (
    <PageShell>
      <PageHeader
        title="Import Tally Bill"
        description="Upload a Tally PDF, XML, or Excel file."
      >
        <ButtonLink href="/supplier/bills/manual" variant="outline">
          <FileText className="mr-1.5 h-4 w-4" />
          Enter manually
        </ButtonLink>
      </PageHeader>
      <ImportForm mappings={mappings} />
    </PageShell>
  );
}
