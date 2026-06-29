'use server';

import { revalidatePath } from 'next/cache';
import { randomBytes } from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireAdmin } from '@/lib/auth';
import { ok, fail, fromZod, type ActionResult } from '@/lib/result';
import { logger, newRequestId } from '@/lib/logger';
import { writeAudit } from '@/lib/audit';
import {
  SupplierInviteInputSchema,
  PricingRuleInputSchema,
  SupplierUpdateInputSchema,
} from '@/lib/validation';
import { describeFormula } from '@/lib/pricing';

export async function getSuppliers() {
  const reqId = newRequestId();
  try {
    await requireAdmin();
    const supabase = await createClient();
    const { data: suppliers, error } = await supabase
      .from('suppliers')
      .select('*')
      .order('name');

    if (error) {
      logger.error('getSuppliers failed', { reqId, error: error.message });
      return [];
    }

    const { data: rules } = await supabase.from('pricing_rules').select('*');
    const ruleBySupplier = new Map((rules ?? []).map((r) => [r.supplier_id, r]));

    return (suppliers ?? []).map((s) => ({
      ...s,
      pricing_rule: ruleBySupplier.get(s.id) ?? null,
    }));
  } catch (err) {
    logger.error('getSuppliers error', { reqId, err });
    return [];
  }
}

export async function getSupplierAdminDashboard(id: string) {
  const reqId = newRequestId();
  try {
    await requireAdmin();
    const supabase = await createClient();

    const { data: supplier, error: supplierError } = await supabase
      .from('suppliers')
      .select('*, pricing_rule:pricing_rules(*)')
      .eq('id', id)
      .single();

    if (supplierError || !supplier) {
      logger.warn('getSupplierAdminDashboard supplier not found', { reqId, id });
      return null;
    }

    const { data: bills } = await supabase
      .from('bills')
      .select('*, bill_items(count)')
      .eq('supplier_id', id)
      .order('created_at', { ascending: false })
      .limit(10);

    const { count: totalBills } = await supabase
      .from('bills')
      .select('*', { count: 'exact', head: true })
      .eq('supplier_id', id);

    const { count: printedBills } = await supabase
      .from('bills')
      .select('*', { count: 'exact', head: true })
      .eq('supplier_id', id)
      .eq('status', 'printed');

    const { data: valueRows } = await supabase
      .from('bills')
      .select('total_amount')
      .eq('supplier_id', id)
      .neq('status', 'cancelled');

    const { data: imports } = await supabase
      .from('tally_imports')
      .select('*')
      .eq('supplier_id', id)
      .order('created_at', { ascending: false })
      .limit(8);

    return {
      supplier,
      bills: bills ?? [],
      imports: imports ?? [],
      totalBills: totalBills ?? 0,
      printedBills: printedBills ?? 0,
      totalValue: (valueRows ?? []).reduce((sum, bill) => sum + Number(bill.total_amount), 0),
    };
  } catch (err) {
    logger.error('getSupplierAdminDashboard error', { reqId, err });
    return null;
  }
}

export async function inviteSupplier(
  formData: FormData
): Promise<
  ActionResult<{
    supplierId: string;
    tempPassword: string;
    formulaSummary: string;
  }>
> {
  const reqId = newRequestId();
  try {
    const admin = await requireAdmin();
    const parsed = SupplierInviteInputSchema.safeParse({
      name: formData.get('name'),
      email: formData.get('email'),
      phone: formData.get('phone') || undefined,
      code_prefix: formData.get('code_prefix') ?? undefined,
      code_number: formData.get('code_number') ?? undefined,
      ma_markup1_pct: formData.get('ma_markup1_pct') ?? 0,
      ma_markup2_pct: formData.get('ma_markup2_pct') ?? 0,
      dna_markup1_pct: formData.get('dna_markup1_pct') ?? 0,
      dna_markup2_pct: formData.get('dna_markup2_pct') ?? 0,
      gst_pct: formData.get('gst_pct') ?? 5,
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
      p_code_prefix: parsed.data.code_prefix || null,
      p_code_number: parsed.data.code_number || null,
      p_ma_markup1_pct: parsed.data.ma_markup1_pct,
      p_ma_markup2_pct: parsed.data.ma_markup2_pct,
      p_dna_markup1_pct: parsed.data.dna_markup1_pct,
      p_dna_markup2_pct: parsed.data.dna_markup2_pct,
      p_gst_pct: parsed.data.gst_pct,
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
    revalidatePath('/admin/pricing');

    const formulaSummary = describeFormula({
      ma_markup1_pct: parsed.data.ma_markup1_pct,
      ma_markup2_pct: parsed.data.ma_markup2_pct,
      dna_markup1_pct: parsed.data.dna_markup1_pct,
      dna_markup2_pct: parsed.data.dna_markup2_pct,
      gst_pct: parsed.data.gst_pct,
    });

    return ok({ supplierId, tempPassword, formulaSummary });
  } catch (err) {
    logger.error('inviteSupplier error', { reqId, err });
    return fail('Invite failed');
  }
}

export async function updateSupplier(
  id: string,
  data: {
    name?: string;
    email?: string;
    phone?: string;
    code_prefix?: string;
    code_number?: string;
  }
): Promise<ActionResult<{ id: string }>> {
  const reqId = newRequestId();
  try {
    await requireAdmin();
    const parsed = SupplierUpdateInputSchema.safeParse(data);
    if (!parsed.success) return fromZod(parsed.error);

    const supabase = await createClient();
    const update: Record<string, string | null | undefined> = {
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      code_prefix: parsed.data.code_prefix || null,
      code_number: parsed.data.code_number || null,
    };
    const { error } = await supabase.from('suppliers').update(update).eq('id', id);
    if (error) return fail(error.message);
    logger.info('updateSupplier success', { reqId, id });
    revalidatePath('/admin/suppliers');
    return ok({ id });
  } catch (err) {
    logger.error('updateSupplier error', { reqId, err });
    return fail('Update failed');
  }
}

export async function activateSupplier(id: string): Promise<ActionResult<{ id: string }>> {
  const reqId = newRequestId();
  try {
    await requireAdmin();
    const supabase = await createClient();
    const { error } = await supabase.from('suppliers').update({ active: true }).eq('id', id);
    if (error) return fail(error.message);
    await writeAudit('activate', 'supplier', id, {});
    logger.info('activateSupplier success', { reqId, id });
    revalidatePath('/admin/suppliers');
    return ok({ id });
  } catch (err) {
    logger.error('activateSupplier error', { reqId, err });
    return fail('Activate failed');
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
      ma_markup1_pct: Number(formData.get('ma_markup1_pct') ?? 0),
      ma_markup2_pct: Number(formData.get('ma_markup2_pct') ?? 0),
      dna_markup1_pct: Number(formData.get('dna_markup1_pct') ?? 0),
      dna_markup2_pct: Number(formData.get('dna_markup2_pct') ?? 0),
      gst_pct: Number(formData.get('gst_pct') ?? 5),
    });
    if (!parsed.success) return fromZod(parsed.error);

    const { supplier_id, ...ruleFields } = parsed.data;
    const supabase = await createClient();
    const { data: existing } = await supabase
      .from('pricing_rules')
      .select('id')
      .eq('supplier_id', supplier_id)
      .single();

    let ruleId: string;
    if (existing) {
      const { data, error } = await supabase
        .from('pricing_rules')
        .update(ruleFields)
        .eq('id', existing.id)
        .select('id')
        .single();
      if (error) return fail(error.message);
      ruleId = data.id;
    } else {
      const { data, error } = await supabase
        .from('pricing_rules')
        .insert({ supplier_id, ...ruleFields, tenant_id: admin.tenant_id })
        .select('id')
        .single();
      if (error) return fail(error.message);
      ruleId = data.id;
    }

    await supabase
      .from('suppliers')
      .update({ pricing_rule_id: ruleId })
      .eq('id', supplier_id);

    await writeAudit('upsert', 'pricing_rule', ruleId, parsed.data);
    logger.info('upsertPricingRule success', { reqId, ruleId });
    revalidatePath('/admin/pricing');
    revalidatePath('/admin/suppliers');

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
