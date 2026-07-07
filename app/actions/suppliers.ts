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
  SupplierCreateInputSchema,
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

    // Which suppliers already have a login? Used to show "Send invite" only for
    // those that don't. Best-effort — if RLS blocks the read we default to
    // "no login" (the invite action itself blocks a duplicate invite).
    const { data: userRows } = await supabase
      .from('users')
      .select('supplier_id')
      .eq('role', 'supplier');
    const loginSet = new Set(
      (userRows ?? []).map((u) => u.supplier_id).filter(Boolean)
    );

    return (suppliers ?? []).map((s) => ({
      ...s,
      pricing_rule: ruleBySupplier.get(s.id) ?? null,
      has_login: loginSet.has(s.id),
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

/**
 * Add a supplier record WITHOUT creating a login/invite. Creates the supplier
 * row and its pricing rule so bills can be imported and priced immediately.
 * Use `sendSupplierInvite` later to give them a login.
 */
export async function createSupplier(
  formData: FormData
): Promise<ActionResult<{ supplierId: string; formulaSummary: string }>> {
  const reqId = newRequestId();
  try {
    const admin = await requireAdmin();
    const parsed = SupplierCreateInputSchema.safeParse({
      name: formData.get('name'),
      email: formData.get('email') || '',
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

    const email = parsed.data.email ? parsed.data.email.toLowerCase().trim() : null;
    const service = createServiceClient();

    const { data: supplier, error: supplierErr } = await service
      .from('suppliers')
      .insert({
        tenant_id: admin.tenant_id,
        name: parsed.data.name,
        email,
        phone: parsed.data.phone ?? null,
        code_prefix: parsed.data.code_prefix || null,
        code_number: parsed.data.code_number || null,
        active: true,
      })
      .select('id')
      .single();

    if (supplierErr || !supplier) {
      logger.error('createSupplier insert failed', { reqId, error: supplierErr?.message });
      return fail(supplierErr?.message ?? 'Failed to create supplier');
    }

    const { data: rule, error: ruleErr } = await service
      .from('pricing_rules')
      .insert({
        tenant_id: admin.tenant_id,
        supplier_id: supplier.id,
        model: 'standard',
        ma_markup1_pct: parsed.data.ma_markup1_pct,
        ma_markup2_pct: parsed.data.ma_markup2_pct,
        dna_markup1_pct: parsed.data.dna_markup1_pct,
        dna_markup2_pct: parsed.data.dna_markup2_pct,
        gst_pct: parsed.data.gst_pct,
      })
      .select('id')
      .single();

    if (ruleErr || !rule) {
      logger.error('createSupplier pricing rule failed', { reqId, error: ruleErr?.message });
      return fail(ruleErr?.message ?? 'Failed to create pricing rule');
    }

    await service.from('suppliers').update({ pricing_rule_id: rule.id }).eq('id', supplier.id);

    await writeAudit('create', 'supplier', supplier.id, { name: parsed.data.name });

    logger.info('createSupplier success', { reqId, supplierId: supplier.id });
    revalidatePath('/admin/suppliers');
    revalidatePath('/admin/pricing');

    const formulaSummary = describeFormula({
      ma_markup1_pct: parsed.data.ma_markup1_pct,
      ma_markup2_pct: parsed.data.ma_markup2_pct,
      dna_markup1_pct: parsed.data.dna_markup1_pct,
      dna_markup2_pct: parsed.data.dna_markup2_pct,
      gst_pct: parsed.data.gst_pct,
    });

    return ok({ supplierId: supplier.id, formulaSummary });
  } catch (err) {
    logger.error('createSupplier error', { reqId, err });
    return fail('Create supplier failed');
  }
}

/**
 * Create a login for an EXISTING supplier and return a one-time temp password.
 * If `email` is provided, the supplier's email is updated first (used when the
 * supplier was added without an email). Blocks a second invite if a login
 * already exists — use `regenerateSupplierPassword` for that case.
 */
export async function sendSupplierInvite(
  supplierId: string,
  email?: string
): Promise<ActionResult<{ tempPassword: string; formulaSummary: string }>> {
  const reqId = newRequestId();
  try {
    const admin = await requireAdmin();
    const service = createServiceClient();

    const { data: supplier, error: supplierErr } = await service
      .from('suppliers')
      .select('id, name, email, tenant_id, pricing_rule:pricing_rules(*)')
      .eq('id', supplierId)
      .single();

    if (supplierErr || !supplier) {
      logger.warn('sendSupplierInvite supplier not found', { reqId, supplierId });
      return fail('Supplier not found');
    }

    const resolvedEmail = (email ?? supplier.email ?? '').toString().toLowerCase().trim();
    if (!resolvedEmail) {
      return fail('Enter an email for this supplier.', 'MISSING_EMAIL');
    }

    // If a new email was supplied, persist it on the supplier row so future
    // actions (regenerate password, etc.) don't need to ask again.
    if (email && email.trim() && email.toLowerCase().trim() !== (supplier.email ?? '').toLowerCase().trim()) {
      await service.from('suppliers').update({ email: resolvedEmail }).eq('id', supplierId);
    }

    const { data: existingUser } = await service
      .from('users')
      .select('id')
      .eq('supplier_id', supplierId)
      .maybeSingle();
    if (existingUser) {
      return fail('This supplier already has a login. Use "New password" instead.', 'ALREADY_INVITED');
    }

    const tempPassword = randomBytes(8).toString('base64url').slice(0, 12);

    const { data: authUser, error: authError } = await service.auth.admin.createUser({
      email: resolvedEmail,
      password: tempPassword,
      email_confirm: true,
      app_metadata: {
        role: 'supplier',
        tenant_id: admin.tenant_id,
        supplier_id: supplierId,
        must_reset_password: true,
      },
    });

    if (authError || !authUser.user) {
      logger.error('sendSupplierInvite auth failed', { reqId, error: authError?.message });
      return fail(authError?.message ?? 'Failed to create login for this supplier');
    }

    await service.from('users').upsert({
      id: authUser.user.id,
      tenant_id: admin.tenant_id,
      role: 'supplier',
      supplier_id: supplierId,
      email: resolvedEmail,
      must_reset_password: true,
    });

    await writeAudit('invite', 'supplier', supplierId, { email: resolvedEmail });

    logger.info('sendSupplierInvite success', { reqId, supplierId });
    revalidatePath('/admin/suppliers');

    const rule = Array.isArray(supplier.pricing_rule)
      ? supplier.pricing_rule[0]
      : supplier.pricing_rule;
    const formulaSummary = rule
      ? describeFormula({
          ma_markup1_pct: Number(rule.ma_markup1_pct) || 0,
          ma_markup2_pct: Number(rule.ma_markup2_pct) || 0,
          dna_markup1_pct: Number(rule.dna_markup1_pct) || 0,
          dna_markup2_pct: Number(rule.dna_markup2_pct) || 0,
          gst_pct: Number(rule.gst_pct) || 5,
        })
      : 'No formula set';

    return ok({ tempPassword, formulaSummary });
  } catch (err) {
    logger.error('sendSupplierInvite error', { reqId, err });
    return fail('Send invite failed');
  }
}

/**
 * Generate a fresh temp password for a supplier that already has a login.
 * Use when the original temp password was lost or never shared. The supplier
 * is forced to reset on next login.
 */
export async function regenerateSupplierPassword(
  supplierId: string
): Promise<ActionResult<{ tempPassword: string }>> {
  const reqId = newRequestId();
  try {
    await requireAdmin();
    const service = createServiceClient();

    const { data: userRow } = await service
      .from('users')
      .select('id, email')
      .eq('supplier_id', supplierId)
      .eq('role', 'supplier')
      .maybeSingle();

    if (!userRow?.id) {
      return fail('This supplier has no login yet. Use Invite first.', 'NO_LOGIN');
    }

    const tempPassword = randomBytes(8).toString('base64url').slice(0, 12);

    const { error: updErr } = await service.auth.admin.updateUserById(userRow.id, {
      password: tempPassword,
      app_metadata: { must_reset_password: true },
    });

    if (updErr) {
      logger.error('regenerateSupplierPassword auth update failed', { reqId, error: updErr.message });
      return fail(updErr.message ?? 'Failed to set new password');
    }

    await service
      .from('users')
      .update({ must_reset_password: true })
      .eq('id', userRow.id);

    await writeAudit('regenerate_password', 'supplier', supplierId, {});

    logger.info('regenerateSupplierPassword success', { reqId, supplierId });
    revalidatePath('/admin/suppliers');

    return ok({ tempPassword });
  } catch (err) {
    logger.error('regenerateSupplierPassword error', { reqId, err });
    return fail('Password reset failed');
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

export async function deleteSupplier(id: string): Promise<ActionResult<{ id: string }>> {
  const reqId = newRequestId();
  try {
    await requireAdmin();
    const supabase = await createClient();

    // Block delete if the supplier has any bills. The FK is ON DELETE CASCADE,
    // so deleting the supplier row would silently delete all their bills too —
    // the admin must export and clear the month (or delete bills) first.
    const { count: billCount, error: billCountErr } = await supabase
      .from('bills')
      .select('*', { count: 'exact', head: true })
      .eq('supplier_id', id);

    if (billCountErr) {
      logger.error('deleteSupplier bill count failed', { reqId, error: billCountErr.message });
      return fail(billCountErr.message);
    }
    if (billCount && billCount > 0) {
      return fail(
        `Cannot delete — this supplier has ${billCount} bill(s). Export and clear the month, or delete the bills first.`,
        'SUPPLIER_HAS_BILLS',
        { billCount }
      );
    }

    // Confirm the supplier exists (avoid a misleading "success" + audit row
    // for a non-existent id).
    const { data: existing } = await supabase
      .from('suppliers')
      .select('id')
      .eq('id', id)
      .maybeSingle();
    if (!existing) {
      return fail('Supplier not found');
    }

    // Find the linked auth user so we can remove their auth account too.
    const { data: userRow } = await supabase
      .from('users')
      .select('id')
      .eq('supplier_id', id)
      .maybeSingle();

    const service = createServiceClient();

    // Delete the supplier row first — cascades pricing_rules and tally_imports,
    // and sets users.supplier_id to null.
    const { error: supplierErr } = await service.from('suppliers').delete().eq('id', id);
    if (supplierErr) {
      logger.error('deleteSupplier supplier delete failed', { reqId, error: supplierErr.message });
      return fail(supplierErr.message);
    }

    // Then remove the auth account (cascades the users row). Best-effort —
    // if the auth user was already removed, this is a no-op.
    if (userRow?.id) {
      const { error: authErr } = await service.auth.admin.deleteUser(userRow.id);
      if (authErr) {
        logger.warn('deleteSupplier auth user delete failed', {
          reqId,
          authUserId: userRow.id,
          error: authErr.message,
        });
      }
    }

    await writeAudit('delete', 'supplier', id, {});
    logger.info('deleteSupplier success', { reqId, id });
    revalidatePath('/admin/suppliers');
    revalidatePath('/admin/pricing');

    return ok({ id });
  } catch (err) {
    logger.error('deleteSupplier error', { reqId, err });
    return fail('Delete failed');
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
