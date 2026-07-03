import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/field';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageHeader, PageShell } from '@/components/layout/page-header';
import { revalidatePath } from 'next/cache';
import { MonthEndPanel } from './month-end-panel';
import { Building2, Save } from 'lucide-react';

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
    <PageShell>
      <PageHeader
        title="Settings"
        description="Manage your tenant profile and month-end reset."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              Tenant profile
            </CardTitle>
            <CardDescription>Shown on invoices and exports.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateTenant} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-medium text-muted-foreground">Tenant name</Label>
                <Input id="name" name="name" defaultValue={tenant?.name ?? ''} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gstin" className="text-xs font-medium text-muted-foreground">GSTIN</Label>
                <Input id="gstin" name="gstin" defaultValue={tenant?.gstin ?? ''} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="address" className="text-xs font-medium text-muted-foreground">Address</Label>
                <Input id="address" name="address" defaultValue={tenant?.address ?? ''} />
              </div>
              <Button type="submit">
                <Save className="mr-1.5 h-4 w-4" />
                Save profile
              </Button>
            </form>
          </CardContent>
        </Card>

        <MonthEndPanel />
      </div>
    </PageShell>
  );
}
