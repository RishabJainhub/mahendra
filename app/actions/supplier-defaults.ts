'use server';

import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';
import { ok, fail, fromZod, type ActionResult } from '@/lib/result';
import { logger, newRequestId } from '@/lib/logger';
import { z } from 'zod';

export type SupplierDefaultImportFormat = {
  supplier_id: string;
  file_type: 'xml' | 'xlsx' | 'xls' | 'csv' | 'pdf';
  mapping_id: string | null;
};

const SaveSchema = z.object({
  supplierId: z.string().uuid(),
  fileType: z.enum(['xml', 'xlsx', 'xls', 'csv', 'pdf']),
  mappingId: z.string().uuid().optional().or(z.literal('')),
});

export async function getSupplierDefaultImportFormat(
  supplierId: string
): Promise<ActionResult<SupplierDefaultImportFormat | null>> {
  const reqId = newRequestId();
  try {
    await requireUser();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('supplier_default_import_format')
      .select('supplier_id, file_type, mapping_id')
      .eq('supplier_id', supplierId)
      .maybeSingle();

    if (error) {
      logger.error('getSupplierDefaultImportFormat error', { reqId, error: error.message });
      return fail('Could not load default import format');
    }
    return ok(data as SupplierDefaultImportFormat | null);
  } catch (err) {
    logger.error('getSupplierDefaultImportFormat error', { reqId, err });
    return fail('Could not load default import format');
  }
}

export async function saveSupplierDefaultImportFormat(
  input: z.infer<typeof SaveSchema>
): Promise<ActionResult<SupplierDefaultImportFormat>> {
  const reqId = newRequestId();
  try {
    await requireUser();
    const parsed = SaveSchema.safeParse(input);
    if (!parsed.success) return fromZod(parsed.error);

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return fail('Not authenticated');

    // Resolve the supplier's tenant_id so we can write it into the row.
    const { data: supplier } = await supabase
      .from('suppliers')
      .select('tenant_id')
      .eq('id', parsed.data.supplierId)
      .maybeSingle();
    if (!supplier) return fail('Supplier not found');

    const row = {
      tenant_id: supplier.tenant_id,
      supplier_id: parsed.data.supplierId,
      file_type: parsed.data.fileType,
      mapping_id: parsed.data.mappingId || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('supplier_default_import_format')
      .upsert(row, { onConflict: 'supplier_id' })
      .select('supplier_id, file_type, mapping_id')
      .single();

    if (error) {
      logger.error('saveSupplierDefaultImportFormat error', { reqId, error: error.message });
      return fail('Could not save default import format');
    }
    return ok(data as SupplierDefaultImportFormat);
  } catch (err) {
    logger.error('saveSupplierDefaultImportFormat error', { reqId, err });
    return fail('Could not save default import format');
  }
}
