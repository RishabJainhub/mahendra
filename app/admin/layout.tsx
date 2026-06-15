import { requireAdmin } from '@/lib/auth';
import { AdminLayout } from '@/components/layout/admin-layout';

export default async function AdminRootLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <AdminLayout>{children}</AdminLayout>;
}
