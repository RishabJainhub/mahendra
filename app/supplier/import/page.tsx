import { getSupplierMappings } from '@/app/actions/supplier';
import { ImportForm } from './import-form';

export default async function SupplierImportPage() {
  const mappings = await getSupplierMappings();
  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">Import Tally Bill</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Choose <strong>PDF</strong> (easiest), XML, or Excel below — then upload your Tally bill.
      </p>
      <ImportForm mappings={mappings} />
    </div>
  );
}
