import { getSupplierMappings } from '@/app/actions/supplier';
import { ImportForm } from './import-form';

export default async function SupplierImportPage() {
  const mappings = await getSupplierMappings();
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Import Tally Bill</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Upload a Tally PDF, XML, or Excel file. PDF works when you only have a printed invoice from Tally.
      </p>
      <ImportForm mappings={mappings} />
    </div>
  );
}
