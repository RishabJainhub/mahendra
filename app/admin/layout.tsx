import { requireAdmin } from '@/lib/auth';
import { AdminLayout } from '@/components/layout/admin-layout';

// Authenticated admin pages read cookies/JWT, so they must render dynamically.
export const dynamic = 'force-dynamic';

export default async function AdminRootLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <AdminLayout>{children}</AdminLayout>;
}
