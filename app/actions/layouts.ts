'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { ok, fail, type ActionResult } from '@/lib/result';
import { logger, newRequestId } from '@/lib/logger';

export async function getLayouts() {
  const reqId = newRequestId();
  try {
    await requireAdmin();
    const supabase = await createClient();
    const { data } = await supabase.from('layouts').select('*').order('name');
    return data ?? [];
  } catch (err) {
    logger.error('getLayouts error', { reqId, err });
    return [];
  }
}

export async function upsertLayout(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const reqId = newRequestId();
  try {
    const admin = await requireAdmin();
    const id = formData.get('id') as string | null;
    const includeFields = JSON.parse(String(formData.get('include_fields') ?? '[]'));
    const payload = {
      name: String(formData.get('name') ?? ''),
      grid_cols: Number(formData.get('grid_cols') ?? 3),
      label_w: Number(formData.get('label_w') ?? 50),
      label_h: Number(formData.get('label_h') ?? 25),
      include_fields: includeFields,
    };

    const supabase = await createClient();
    if (id) {
      const { error } = await supabase.from('layouts').update(payload).eq('id', id);
      if (error) {
        logger.error('upsertLayout update failed', { reqId, id, error: error.message });
        return fail('Layout save failed');
      }
      revalidatePath('/admin/layouts');
      return ok({ id });
    }

    const { data, error } = await supabase
      .from('layouts')
      .insert({ ...payload, tenant_id: admin.tenant_id })
      .select('id')
      .single();
    if (error) {
      logger.error('upsertLayout insert failed', { reqId, error: error.message });
      return fail('Layout save failed');
    }
    logger.info('upsertLayout success', { reqId, id: data.id });
    revalidatePath('/admin/layouts');
    return ok({ id: data.id });
  } catch (err) {
    logger.error('upsertLayout error', { reqId, err });
    return fail('Layout save failed');
  }
}

export async function deleteLayout(id: string): Promise<ActionResult<{ id: string }>> {
  const reqId = newRequestId();
  try {
    await requireAdmin();
    const supabase = await createClient();
    const { error } = await supabase.from('layouts').delete().eq('id', id);
    if (error) {
      logger.error('deleteLayout failed', { reqId, id, error: error.message });
      return fail('Delete failed');
    }
    logger.info('deleteLayout success', { reqId, id });
    revalidatePath('/admin/layouts');
    return ok({ id });
  } catch (err) {
    logger.error('deleteLayout error', { reqId, err });
    return fail('Delete failed');
  }
}
