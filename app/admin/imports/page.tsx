import { getSuppliers } from '@/app/actions/suppliers';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { ImportForm } from './import-form';

export default async function AdminImportsPage() {
  await requireAdmin();
  const suppliers = await getSuppliers();
  const supabase = await createClient();
  const { data: mappings } = await supabase.from('tally_column_mappings').select('*');

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Admin Imports</h1>
      <p className="mb-4 text-muted-foreground">Import Tally bills on behalf of a supplier.</p>
      <ImportForm suppliers={suppliers} mappings={mappings ?? []} />
    </div>
  );
}
