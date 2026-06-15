import { getSupplierMappings } from '@/app/actions/supplier';
import { ImportForm } from './import-form';

export default async function SupplierImportPage() {
  const mappings = await getSupplierMappings();
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Import Tally Bill</h1>
      <ImportForm mappings={mappings} />
    </div>
  );
}
