import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export type AppUser = {
  id: string;
  email: string;
  role: 'admin' | 'supplier';
  tenant_id: string;
  supplier_id: string | null;
  must_reset_password: boolean;
  tenant?: { id: string; name: string; gstin?: string; address?: string };
  supplier?: {
    id: string;
    name: string;
    email?: string;
    code_prefix?: string | null;
    code_number?: string | null;
    active?: boolean;
  };
};

export async function getUser(): Promise<AppUser | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const appMeta = user.app_metadata ?? {};
  const role = appMeta.role as 'admin' | 'supplier' | undefined;
  const tenantId = appMeta.tenant_id as string | undefined;
  if (!role || !tenantId) return null;

  const { data: profile } = await supabase
    .from('users')
    .select(
      '*, tenant:tenants(id, name, gstin, address), supplier:suppliers(id, name, email, code_prefix, code_number, active)'
    )
    .eq('id', user.id)
    .single();

  if (!profile) return null;

  return {
    id: user.id,
    email: user.email ?? profile.email,
    role,
    tenant_id: tenantId,
    supplier_id: (appMeta.supplier_id as string) ?? profile.supplier_id,
    must_reset_password: profile.must_reset_password ?? false,
    tenant: profile.tenant ?? undefined,
    supplier: profile.supplier ?? undefined,
  };
}

export async function requireUser(): Promise<AppUser> {
  const user = await getUser();
  if (!user) redirect('/login');
  return user;
}

export async function requireAdmin(): Promise<AppUser> {
  const user = await requireUser();
  if (user.role !== 'admin') redirect('/login');
  return user;
}

export async function requireSupplier(): Promise<AppUser> {
  const user = await requireUser();
  if (user.role !== 'supplier') redirect('/login');
  if (!user.supplier_id) redirect('/login');
  if (user.supplier?.active === false) {
    redirect('/login');
  }
  return user;
}
