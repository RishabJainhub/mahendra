import { getSuppliers } from '@/app/actions/suppliers';
import { SuppliersClient } from './client-page';

export default async function AdminSuppliersPage() {
  const suppliers = await getSuppliers();
  return <SuppliersClient suppliers={suppliers} />;
}
