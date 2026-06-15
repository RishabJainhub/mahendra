'use server';

import { revalidatePath } from 'next/cache';
import { randomBytes } from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireAdmin } from '@/lib/auth';
import { ok, fail, fromZod, type ActionResult } from '@/lib/result';
import { logger, newRequestId } from '@/lib/logger';
import { writeAudit } from '@/lib/audit';
import { SupplierInviteInputSchema, PricingRuleInputSchema } from '@/lib/validation';

export async function getSuppliers() {
  const reqId = newRequestId();
  try {
    await requireAdmin();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('suppliers')
      .select('*, pricing_rule:pricing_rules(*)')
      .order('name');

    if (error) {
      logger.error('getSuppliers failed', { reqId, error: error.message });
      return [];
    }
    return data ?? [];
  } catch (err) {
    logger.error('getSuppliers error', { reqId, err });
    return [];
  }
}

export async function inviteSupplier(
  formData: FormData
): Promise<ActionResult<{ supplierId: string; tempPassword: string }>> {
  const reqId = newRequestId();
  try {
    const admin = await requireAdmin();
    const parsed = SupplierInviteInputSchema.safeParse({
      name: formData.get('name'),
      email: formData.get('email'),
      phone: formData.get('phone') || undefined,
      pricing_rule_id: formData.get('pricing_rule_id') || undefined,
    });
    if (!parsed.success) return fromZod(parsed.error);

    const tempPassword = randomBytes(8).toString('base64url').slice(0, 12);
    const service = createServiceClient();

    const { data: authUser, error: authError } = await service.auth.admin.createUser({
      email: parsed.data.email,
      password: tempPassword,
      email_confirm: true,
      app_metadata: {
        role: 'supplier',
        tenant_id: admin.tenant_id,
        must_reset_password: true,
      },
    });

    if (authError || !authUser.user) {
      logger.error('inviteSupplier auth failed', { reqId, error: authError?.message });
      return fail(authError?.message ?? 'Failed to create user');
    }

    const { data: supplierId, error: rpcError } = await service.rpc('provision_supplier_user', {
      email: parsed.data.email,
      p_tenant_id: admin.tenant_id,
    });

    if (rpcError || !supplierId) {
      logger.error('inviteSupplier rpc failed', { reqId, error: rpcError?.message });
      return fail(rpcError?.message ?? 'Failed to provision supplier');
    }

    await service.from('suppliers').update({
      name: parsed.data.name,
      phone: parsed.data.phone,
    }).eq('id', supplierId);

    await service.from('users').upsert({
      id: authUser.user.id,
      tenant_id: admin.tenant_id,
      role: 'supplier',
      supplier_id: supplierId,
      email: parsed.data.email,
      must_reset_password: true,
    });

    await service.auth.admin.updateUserById(authUser.user.id, {
      app_metadata: {
        role: 'supplier',
        tenant_id: admin.tenant_id,
        supplier_id: supplierId,
        must_reset_password: true,
      },
    });

    await writeAudit('invite', 'supplier', supplierId, { email: parsed.data.email });

    logger.info('inviteSupplier success', { reqId, supplierId });
    revalidatePath('/admin/suppliers');

    return ok({ supplierId, tempPassword });
  } catch (err) {
    logger.error('inviteSupplier error', { reqId, err });
    return fail('Invite failed');
  }
}

export async function updateSupplier(
  id: string,
  data: { name?: string; email?: string; phone?: string }
): Promise<ActionResult<{ id: string }>> {
  const reqId = newRequestId();
  try {
    await requireAdmin();
    const supabase = await createClient();
    const { error } = await supabase.from('suppliers').update(data).eq('id', id);
    if (error) return fail(error.message);
    logger.info('updateSupplier success', { reqId, id });
    revalidatePath('/admin/suppliers');
    return ok({ id });
  } catch (err) {
    logger.error('updateSupplier error', { reqId, err });
    return fail('Update failed');
  }
}

export async function deactivateSupplier(id: string): Promise<ActionResult<{ id: string }>> {
  const reqId = newRequestId();
  try {
    await requireAdmin();
    const supabase = await createClient();
    const { error } = await supabase.from('suppliers').update({ active: false }).eq('id', id);
    if (error) return fail(error.message);
    await writeAudit('deactivate', 'supplier', id, {});
    logger.info('deactivateSupplier success', { reqId, id });
    revalidatePath('/admin/suppliers');
    return ok({ id });
  } catch (err) {
    logger.error('deactivateSupplier error', { reqId, err });
    return fail('Deactivate failed');
  }
}

export async function upsertPricingRule(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const reqId = newRequestId();
  try {
    const admin = await requireAdmin();
    const parsed = PricingRuleInputSchema.safeParse({
      supplier_id: formData.get('supplier_id'),
      model: formData.get('model'),
      margin_pct: Number(formData.get('margin_pct') ?? 0),
      markup_pct: Number(formData.get('markup_pct') ?? 0),
      gst_pct: Number(formData.get('gst_pct') ?? 5),
    });
    if (!parsed.success) return fromZod(parsed.error);

    const supabase = await createClient();
    const { data: existing } = await supabase
      .from('pricing_rules')
      .select('id')
      .eq('supplier_id', parsed.data.supplier_id)
      .single();

    let ruleId: string;
    if (existing) {
      const { data, error } = await supabase
        .from('pricing_rules')
        .update(parsed.data)
        .eq('id', existing.id)
        .select('id')
        .single();
      if (error) return fail(error.message);
      ruleId = data.id;
    } else {
      const { data, error } = await supabase
        .from('pricing_rules')
        .insert({ ...parsed.data, tenant_id: admin.tenant_id })
        .select('id')
        .single();
      if (error) return fail(error.message);
      ruleId = data.id;
    }

    await supabase
      .from('suppliers')
      .update({ pricing_rule_id: ruleId })
      .eq('id', parsed.data.supplier_id);

    await writeAudit('upsert', 'pricing_rule', ruleId, parsed.data);
    logger.info('upsertPricingRule success', { reqId, ruleId });
    revalidatePath('/admin/pricing');

    return ok({ id: ruleId });
  } catch (err) {
    logger.error('upsertPricingRule error', { reqId, err });
    return fail('Pricing rule update failed');
  }
}

export async function getPricingRules() {
  const reqId = newRequestId();
  try {
    await requireAdmin();
    const supabase = await createClient();
    const { data } = await supabase
      .from('pricing_rules')
      .select('*, supplier:suppliers(id, name)')
      .order('supplier_id');
    return data ?? [];
  } catch (err) {
    logger.error('getPricingRules error', { reqId, err });
    return [];
  }
}
