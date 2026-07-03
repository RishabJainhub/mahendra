import { requireSupplier } from '@/lib/auth';
import { SupplierLayout } from '@/components/layout/supplier-layout';

export const dynamic = 'force-dynamic';

export default async function SupplierRootLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSupplier();
  return (
    <SupplierLayout
      supplierName={user.supplier?.name}
      mustResetPassword={user.must_reset_password}
    >
      {children}
    </SupplierLayout>
  );
}
