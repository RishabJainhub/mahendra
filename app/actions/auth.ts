'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { ok, fail, type ActionResult } from '@/lib/result';
import { logger, newRequestId } from '@/lib/logger';
import { ResetPasswordSchema, parseFormData } from '@/lib/validation';

export async function signIn(formData: FormData): Promise<ActionResult<never>> {
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

    const role = data.user?.app_metadata?.role as string | undefined;
    logger.info('signIn success', { reqId, role });
    revalidatePath('/', 'layout');

    if (role === 'admin') redirect('/admin');
    if (role === 'supplier') redirect('/supplier');
    redirect('/login');
  } catch (err) {
    if (err && typeof err === 'object' && 'digest' in err) throw err;
    logger.error('signIn error', { reqId, err });
    return fail('Sign in failed');
  }
}

export async function signOut(): Promise<void> {
  const reqId = newRequestId();
  const supabase = await createClient();
  await supabase.auth.signOut();
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
