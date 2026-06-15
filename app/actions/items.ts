'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { ok, fail, type ActionResult } from '@/lib/result';
import { logger, newRequestId } from '@/lib/logger';

export async function getItems() {
  const reqId = newRequestId();
  try {
    await requireAdmin();
    const supabase = await createClient();
    const { data, error } = await supabase.from('items').select('*').order('sku');
    if (error) {
      logger.error('getItems failed', { reqId, error: error.message });
      return [];
    }
    return data ?? [];
  } catch (err) {
    logger.error('getItems error', { reqId, err });
    return [];
  }
}

export async function upsertItem(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const reqId = newRequestId();
  try {
    const admin = await requireAdmin();
    const id = formData.get('id') as string | null;
    const payload = {
      sku: String(formData.get('sku') ?? ''),
      name: String(formData.get('name') ?? ''),
      hsn: String(formData.get('hsn') ?? '') || null,
      base_rate: Number(formData.get('base_rate') ?? 0),
      mrp: Number(formData.get('mrp') ?? 0),
      gst_rate: Number(formData.get('gst_rate') ?? 5),
    };

    const supabase = await createClient();
    if (id) {
      const { error } = await supabase.from('items').update(payload).eq('id', id);
      if (error) return fail(error.message);
      logger.info('upsertItem update', { reqId, id });
      revalidatePath('/admin/items');
      return ok({ id });
    }

    const { data, error } = await supabase
      .from('items')
      .insert({ ...payload, tenant_id: admin.tenant_id })
      .select('id')
      .single();
    if (error) return fail(error.message);
    logger.info('upsertItem insert', { reqId, id: data.id });
    revalidatePath('/admin/items');
    return ok({ id: data.id });
  } catch (err) {
    logger.error('upsertItem error', { reqId, err });
    return fail('Item save failed');
  }
}

export async function bulkImportItems(
  items: { sku: string; name: string; hsn?: string; base_rate: number; mrp: number; gst_rate?: number }[]
): Promise<ActionResult<{ count: number }>> {
  const reqId = newRequestId();
  try {
    const admin = await requireAdmin();
    const supabase = await createClient();
    const rows = items.map((item) => ({
      ...item,
      tenant_id: admin.tenant_id,
      gst_rate: item.gst_rate ?? 5,
    }));

    const { error } = await supabase.from('items').insert(rows);
    if (error) return fail(error.message);
    logger.info('bulkImportItems success', { reqId, count: items.length });
    revalidatePath('/admin/items');
    return ok({ count: items.length });
  } catch (err) {
    logger.error('bulkImportItems error', { reqId, err });
    return fail('Bulk import failed');
  }
}
