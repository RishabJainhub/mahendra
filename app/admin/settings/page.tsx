import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { revalidatePath } from 'next/cache';
import { MonthEndPanel } from './month-end-panel';

async function updateTenant(formData: FormData) {
  'use server';
  const admin = await requireAdmin();
  const supabase = await createClient();
  await supabase.from('tenants').update({
    name: String(formData.get('name') ?? ''),
    gstin: String(formData.get('gstin') ?? '') || null,
    address: String(formData.get('address') ?? '') || null,
  }).eq('id', admin.tenant_id);
  revalidatePath('/admin/settings');
}

export default async function AdminSettingsPage() {
  const admin = await requireAdmin();
  const supabase = await createClient();
  const { data: tenant } = await supabase.from('tenants').select('*').eq('id', admin.tenant_id).single();

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Settings</h1>
      <form action={updateTenant} className="max-w-lg space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Tenant Name</label>
          <Input name="name" defaultValue={tenant?.name ?? ''} required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">GSTIN</label>
          <Input name="gstin" defaultValue={tenant?.gstin ?? ''} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Address</label>
          <Input name="address" defaultValue={tenant?.address ?? ''} />
        </div>
        <Button type="submit">Save</Button>
      </form>

      <div className="mt-10">
        <MonthEndPanel />
      </div>
    </div>
  );
}
