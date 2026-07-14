'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { ok, fail, type ActionResult } from '@/lib/result';
import { logger, newRequestId } from '@/lib/logger';
import { ResetPasswordSchema, parseFormData } from '@/lib/validation';

async function resolveLoginRole(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  appMeta: Record<string, unknown>
): Promise<{ role: 'admin' | 'supplier'; tenantId: string; supplierId: string | null } | null> {
  let role = appMeta.role as 'admin' | 'supplier' | undefined;
  let tenantId = appMeta.tenant_id as string | undefined;
  const supplierIdFromMeta = appMeta.supplier_id as string | undefined;

  if (role && tenantId) {
    return { role, tenantId, supplierId: supplierIdFromMeta ?? null };
  }

  const service = createServiceClient();
  const { data: profile } = await service
    .from('users')
    .select('role, tenant_id, supplier_id, must_reset_password')
    .eq('id', userId)
    .maybeSingle();

  if (!profile?.role || !profile.tenant_id) {
    return null;
  }

  await service.rpc('sync_user_app_metadata', {
    p_user_id: userId,
    p_tenant_id: profile.tenant_id,
    p_role: profile.role,
    p_supplier_id: profile.supplier_id,
    p_must_reset_password: profile.must_reset_password ?? false,
  });

  await supabase.auth.refreshSession();
  const {
    data: { user: refreshed },
  } = await supabase.auth.getUser();

  role = refreshed?.app_metadata?.role as 'admin' | 'supplier' | undefined;
  tenantId = refreshed?.app_metadata?.tenant_id as string | undefined;

  if (role && tenantId) {
    return {
      role,
      tenantId,
      supplierId: (refreshed?.app_metadata?.supplier_id as string) ?? profile.supplier_id ?? null,
    };
  }

  return {
    role: profile.role as 'admin' | 'supplier',
    tenantId: profile.tenant_id,
    supplierId: profile.supplier_id ?? null,
  };
}

export async function signIn(
  _prevState: ActionResult<never> | null,
  formData: FormData
): Promise<ActionResult<never>> {
  const reqId = newRequestId();
  try {
    const email = String(formData.get('email') ?? '');
    const password = String(formData.get('password') ?? '');

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      logger.warn('signIn failed', { reqId, error: error.message });
      return fail(error.message, 'AUTH_ERROR');
    }

    const user = data.user;
    if (!user) {
      return fail('Sign in failed', 'AUTH_ERROR');
    }

    const resolved = await resolveLoginRole(supabase, user.id, user.app_metadata ?? {});
    if (!resolved) {
      await supabase.auth.signOut({ scope: 'local' });
      logger.warn('signIn missing profile', { reqId, userId: user.id });
      return fail(
        'No login profile found for this account. After a database reset, create an admin: node create_admin.js',
        'ACCOUNT_NOT_PROVISIONED'
      );
    }

    const { role } = resolved;
    if (role !== 'admin' && role !== 'supplier') {
      await supabase.auth.signOut({ scope: 'local' });
      return fail('Invalid account role. Contact an administrator.', 'INVALID_ROLE');
    }

    // Block deactivated supplier accounts at sign-in.
    if (role === 'supplier') {
      const service = createServiceClient();
      const { data: supplierRow } = await service
        .from('suppliers')
        .select('active')
        .eq('id', resolved.supplierId ?? '')
        .maybeSingle();
      if (supplierRow && supplierRow.active === false) {
        await supabase.auth.signOut({ scope: 'local' });
        logger.warn('signIn blocked deactivated supplier', { reqId, userId: user.id });
        return fail(
          'Your supplier account has been deactivated. Contact the administrator.',
          'ACCOUNT_DEACTIVATED'
        );
      }
    }

    logger.info('signIn success', { reqId, role });
    revalidatePath('/', 'layout');

    if (role === 'admin') redirect('/admin');
    redirect('/supplier');
  } catch (err) {
    if (err && typeof err === 'object' && 'digest' in err) throw err;
    logger.error('signIn error', { reqId, err });
    return fail('Sign in failed');
  }
}

export async function signOut(): Promise<void> {
  const reqId = newRequestId();
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: 'local' });
  logger.info('signOut', { reqId });
  revalidatePath('/', 'layout');
  redirect('/login');
}

export async function resetPassword(formData: FormData): Promise<ActionResult<never>> {
  const reqId = newRequestId();
  try {
    const parsed = parseFormData(formData, ResetPasswordSchema);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return fail('Not authenticated', 'UNAUTHORIZED');

    const { error } = await supabase.auth.updateUser({ password: parsed.newPassword });
    if (error) {
      logger.warn('resetPassword auth failed', { reqId, error: error.message });
      return fail(error.message);
    }

    const service = createServiceClient();
    await service.from('users').update({ must_reset_password: false }).eq('id', user.id);
    await service.auth.admin.updateUserById(user.id, {
      app_metadata: { ...user.app_metadata, must_reset_password: false },
    });

    const role = user.app_metadata?.role as string | undefined;
    logger.info('resetPassword success', { reqId, role });
    revalidatePath('/', 'layout');

    if (role === 'admin') redirect('/admin');
    redirect('/supplier');
  } catch (err) {
    if (err && typeof err === 'object' && 'digest' in err) throw err;
    logger.error('resetPassword error', { reqId, err });
    return fail('Password reset failed');
  }
}
