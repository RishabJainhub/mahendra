import Link from 'next/link';
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

      <div className="mt-8 rounded-lg border border-dashed p-4">
        <h2 className="text-sm font-semibold">No Tally file? Have a physical bill?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Type in the bill items by hand — useful for paper bills or scanned PDFs that can't be parsed.
        </p>
        <Link
          href="/admin/bills/manual"
          className="mt-2 inline-flex h-9 items-center rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-accent"
        >
          Enter bill manually →
        </Link>
      </div>
    </div>
  );
}
