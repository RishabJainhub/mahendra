'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin, requireUser } from '@/lib/auth';
import { ok, fail, fromZod, type ActionResult } from '@/lib/result';
import { logger, newRequestId } from '@/lib/logger';
import { writeAudit } from '@/lib/audit';
import { TallyImportInputSchema } from '@/lib/validation';
import { parseTallyXml } from '@/lib/tally/xml-parser';
import { parseTallyXlsx } from '@/lib/tally/excel-parser';
import { parseTallyPdf } from '@/lib/tally/pdf-parser';
import { DEFAULT_TALLY_MAPPING_ID } from '@/lib/tally/constants';

export type BillFilters = {
  status?: string;
  supplierId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
};

export async function getBills(filters: BillFilters = {}) {
  const reqId = newRequestId();
  try {
    await requireUser();
    const supabase = await createClient();
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('bills')
      .select('*, supplier:suppliers(name), bill_items(count)', { count: 'exact' })
      .order('bill_date', { ascending: false })
      .range(from, to);

    if (filters.status) query = query.eq('status', filters.status);
    if (filters.supplierId) query = query.eq('supplier_id', filters.supplierId);
    if (filters.from) query = query.gte('bill_date', filters.from);
    if (filters.to) query = query.lte('bill_date', filters.to);

    const { data, error, count } = await query;
    if (error) {
      logger.error('getBills failed', { reqId, error: error.message });
      return { bills: [], total: 0 };
    }
    return { bills: data ?? [], total: count ?? 0 };
  } catch (err) {
    logger.error('getBills error', { reqId, err });
    return { bills: [], total: 0 };
  }
}

export async function getBill(id: string) {
  const reqId = newRequestId();
  try {
    await requireUser();
    const supabase = await createClient();

    const { data: bill, error } = await supabase
      .from('bills')
      .select('*, supplier:suppliers(name, email), bill_items(*, item:items(sku, name))')
      .eq('id', id)
      .single();

    if (error || !bill) {
      logger.warn('getBill not found', { reqId, id });
      return null;
    }

    const { data: audit } = await supabase
      .from('audit_log')
      .select('*')
      .eq('entity', 'bill')
      .eq('entity_id', id)
      .order('created_at', { ascending: false })
      .limit(20);

    return { ...bill, audit: audit ?? [] };
  } catch (err) {
    logger.error('getBill error', { reqId, err });
    return null;
  }
}

export async function previewTallyBill(input: {
  fileName: string;
  fileType: 'xml' | 'xlsx' | 'xls' | 'pdf';
  fileContent: string;
  mappingId?: string;
}): Promise<
  ActionResult<{
    bill: { number: string; date: string; party: string; total: number };
    items: { sku: string; name: string; qty: number; rate: number }[];
  }>
> {
  const reqId = newRequestId();
  try {
    await requireUser();
    const parsed = TallyImportInputSchema.safeParse(input);
    if (!parsed.success) return fromZod(parsed.error);

    const result = await parseTallyImport(parsed.data);
    return ok({
      bill: {
        number: result.bill.number,
        date: result.bill.date,
        party: result.bill.party,
        total: result.bill.totals.amount,
      },
      items: result.items.map((i) => ({
        sku: i.sku,
        name: i.name,
        qty: i.qty,
        rate: i.rate,
      })),
    });
  } catch (err) {
    logger.error('previewTallyBill error', { reqId, err });
    return fail(err instanceof Error ? err.message : 'Could not read this file');
  }
}

async function parseTallyImport(parsed: {
  fileType: 'xml' | 'xlsx' | 'xls' | 'pdf';
  fileContent: string;
  mappingId?: string;
}) {
  if (parsed.fileType === 'xml') {
    return parseTallyXml(parsed.fileContent);
  }
  if (parsed.fileType === 'pdf') {
    const buffer = Buffer.from(parsed.fileContent, 'base64');
    return parseTallyPdf(buffer);
  }
  const supabase = await createClient();
  const mappingId = parsed.mappingId ?? DEFAULT_TALLY_MAPPING_ID;
  const { data: mapping } = await supabase
    .from('tally_column_mappings')
    .select('column_map')
    .eq('id', mappingId)
    .single();
  if (!mapping) throw new Error('Column mapping not found');
  const buffer = Buffer.from(parsed.fileContent, 'base64');
  return parseTallyXlsx(buffer, mapping.column_map as Record<string, string>);
}

export async function importTallyBill(
  input: {
    fileName: string;
    fileType: 'xml' | 'xlsx' | 'xls' | 'pdf';
    fileContent: string;
    mappingId?: string;
    supplierId?: string;
  }
): Promise<ActionResult<{ billId: string; itemCount: number }>> {
  const reqId = newRequestId();
  try {
    const user = await requireUser();
    const parsed = TallyImportInputSchema.safeParse(input);
    if (!parsed.success) return fromZod(parsed.error);

    const supplierId = input.supplierId ?? user.supplier_id;
    if (!supplierId) return fail('Supplier ID required', 'VALIDATION_ERROR');

    let billData: { number: string; date: string; party: string; totals: { amount: number } };
    let items: { sku: string; name: string; qty: number; rate: number; hsn?: string }[];

    const parsedBill = await parseTallyImport({
      fileType: parsed.data.fileType,
      fileContent: parsed.data.fileContent,
      mappingId: parsed.data.mappingId,
    });
    billData = parsedBill.bill;
    items = parsedBill.items;

    const mappingId = parsed.data.mappingId ?? DEFAULT_TALLY_MAPPING_ID;

    const supabase = await createClient();

    const { data: bill, error: billError } = await supabase
      .from('bills')
      .insert({
        supplier_id: supplierId,
        bill_number: billData.number,
        bill_date: billData.date,
        total_amount: billData.totals.amount,
        status: 'imported',
      })
      .select('id')
      .single();

    if (billError || !bill) {
      logger.error('importTallyBill bill insert failed', { reqId, error: billError?.message });
      return fail(billError?.message ?? 'Failed to create bill');
    }

    const billItems = items.map((item) => ({
      bill_id: bill.id,
      sku: item.sku,
      name: item.name,
      qty: item.qty,
      rate: item.rate,
    }));

    const { error: itemsError } = await supabase.from('bill_items').insert(billItems);
    if (itemsError) {
      logger.error('importTallyBill items insert failed', { reqId, error: itemsError.message });
      return fail(itemsError.message);
    }

    await supabase.from('tally_imports').insert({
      supplier_id: supplierId,
      file_name: parsed.data.fileName,
      file_type: parsed.data.fileType,
      mapping_id: mappingId,
      status: 'completed',
    });

    await writeAudit('import', 'bill', bill.id, { fileName: parsed.data.fileName, itemCount: items.length });

    logger.info('importTallyBill success', { reqId, billId: bill.id, itemCount: items.length });
    revalidatePath('/admin/bills');
    revalidatePath('/supplier');
    revalidatePath('/supplier/history');

    return ok({ billId: bill.id, itemCount: items.length });
  } catch (err) {
    logger.error('importTallyBill error', { reqId, err });
    return fail('Import failed');
  }
}

export async function cancelBill(id: string): Promise<ActionResult<{ id: string }>> {
  const reqId = newRequestId();
  try {
    await requireAdmin();
    const supabase = await createClient();

    const { error } = await supabase
      .from('bills')
      .update({ status: 'cancelled' })
      .eq('id', id);

    if (error) {
      logger.error('cancelBill failed', { reqId, error: error.message });
      return fail(error.message);
    }

    await writeAudit('cancel', 'bill', id, {});
    logger.info('cancelBill success', { reqId, id });
    revalidatePath('/admin/bills');
    revalidatePath(`/admin/bills/${id}`);

    return ok({ id });
  } catch (err) {
    logger.error('cancelBill error', { reqId, err });
    return fail('Cancel failed');
  }
}

export async function cancelBillAction(id: string): Promise<void> {
  await cancelBill(id);
}

export async function markBillPrinted(id: string): Promise<ActionResult<{ id: string }>> {
  const reqId = newRequestId();
  try {
    await requireUser();
    const supabase = await createClient();

    const { error } = await supabase
      .from('bills')
      .update({ status: 'printed' })
      .eq('id', id);

    if (error) {
      logger.error('markBillPrinted failed', { reqId, error: error.message });
      return fail(error.message);
    }

    await writeAudit('print', 'bill', id, {});
    logger.info('markBillPrinted success', { reqId, id });
    revalidatePath('/admin/bills');
    revalidatePath('/supplier');
    revalidatePath('/supplier/history');

    return ok({ id });
  } catch (err) {
    logger.error('markBillPrinted error', { reqId, err });
    return fail('Mark printed failed');
  }
}
