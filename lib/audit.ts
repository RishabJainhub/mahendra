'use server';

import { createClient } from '@/lib/supabase/server';
import { newRequestId } from '@/lib/logger';

export async function writeAudit(
  action: string,
  entity: string,
  entityId: string | null,
  diff: Record<string, unknown> = {}
): Promise<void> {
  const reqId = newRequestId();
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('audit_log').insert({
      actor_id: user.id,
      action,
      entity,
      entity_id: entityId || null,
      diff,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[audit]', { reqId, action, entity, entityId, err });
  }
}
