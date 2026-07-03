import { getSuppliers } from '@/app/actions/suppliers';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { PageHeader, PageShell } from '@/components/layout/page-header';
import { ButtonLink } from '@/components/ui/button-link';
import { FileText } from 'lucide-react';
import { ImportForm } from './import-form';

export default async function AdminImportsPage() {
  await requireAdmin();
  const suppliers = await getSuppliers();
  const supabase = await createClient();
  const { data: mappings } = await supabase.from('tally_column_mappings').select('*');

  return (
    <PageShell>
      <PageHeader
        title="Imports"
        description="Import Tally bills on behalf of a supplier."
      >
        <ButtonLink href="/admin/bills/manual" variant="outline">
          <FileText className="mr-1.5 h-4 w-4" />
          Manual entry
        </ButtonLink>
      </PageHeader>
      <ImportForm suppliers={suppliers} mappings={mappings ?? []} />
    </PageShell>
  );
}
