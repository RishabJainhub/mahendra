'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin, requireUser } from '@/lib/auth';
import { ok, fail, fromZod, type ActionResult } from '@/lib/result';
import { logger, newRequestId } from '@/lib/logger';
import { writeAudit } from '@/lib/audit';
import { TallyImportInputSchema, ManualBillInputSchema } from '@/lib/validation';
import { parseTallyXml } from '@/lib/tally/xml-parser';
import { parseTallyXlsx } from '@/lib/tally/excel-parser';
import { parseTallyPdf } from '@/lib/tally/pdf-parser';
import { DEFAULT_TALLY_MAPPING_ID } from '@/lib/tally/constants';
import { fetchTallyUpload, deleteTallyUpload } from '@/lib/tally/storage';
import { APP_NAME } from '@/lib/brand';
import { calcMA, calcDNA } from '@/lib/pricing';
import { extractHsnFromDescription } from '@/lib/tally/hsn';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

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
    await requireAdmin();
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

export async function getSupplierBill(id: string) {
  const reqId = newRequestId();
  try {
    await requireUser();
    const supabase = await createClient();

    const { data: bill, error } = await supabase
      .from('bills')
      .select('*, supplier:suppliers(name), bill_items(*, item:items(sku, name))')
      .eq('id', id)
      .single();

    if (error || !bill) {
      logger.warn('getSupplierBill not found', { reqId, id });
      return null;
    }

    return bill;
  } catch (err) {
    logger.error('getSupplierBill error', { reqId, err });
    return null;
  }
}

export type StickerBill = {
  bill_number: string;
  bill_date: string;
  supplier_name: string;
  supplier_code: string;
  tenant_name: string;
  tenant_gstin?: string;
  total_amount: number;
};

export type StickerItem = {
  description: string;
  hsn?: string;
  ma_price: number;
  dna_price: number;
  qty: number;
};

export type PrintableBillRow = {
  id: string;
  bill_number: string;
  bill_date: string;
  status: string;
  supplier_name: string;
};

function mapBillRowToStickers(bill: {
  bill_number: string;
  bill_date: string;
  total_amount: number | string;
  supplier: {
    name: string;
    code_prefix: string | null;
    code_number: string | null;
  } | null;
  tenant: { name: string; gstin?: string | null } | null;
  bill_items: {
    name: string;
    hsn: string | null;
    qty: number | string | null;
    ma_price: number | string | null;
    dna_price: number | string | null;
    item?: { hsn?: string | null } | null;
  }[];
}): { bill: StickerBill; items: StickerItem[] } {
  const rawItems = bill.bill_items ?? [];
  const items: StickerItem[] = rawItems.map((item) => {
    const hsn =
      (item.hsn?.toString().trim() || '') ||
      (item.item?.hsn?.toString().trim() || '') ||
      undefined;
    const qty = Math.max(1, Math.round(Number(item.qty ?? 1)));
    return {
      description: item.name,
      hsn,
      ma_price: Number(item.ma_price ?? 0),
      dna_price: Number(item.dna_price ?? 0),
      qty,
    };
  });

  const supplier = bill.supplier;
  return {
    bill: {
      bill_number: bill.bill_number,
      bill_date: bill.bill_date,
      supplier_name: supplier?.name ?? '',
      supplier_code: (supplier?.code_prefix ?? '').trim(),
      tenant_name: bill.tenant?.name ?? APP_NAME,
      tenant_gstin: bill.tenant?.gstin ?? undefined,
      total_amount: Number(bill.total_amount),
    },
    items,
  };
}

const BILL_LIST_PAGE = 500;

export async function getPrintableBills(filters: {
  status?: string;
  from?: string;
  to?: string;
  search?: string;
} = {}): Promise<{ bills: PrintableBillRow[]; total: number }> {
  const reqId = newRequestId();
  try {
    await requireAdmin();
    const supabase = await createClient();
    const all: PrintableBillRow[] = [];
    let offset = 0;
    let total = 0;

    while (true) {
      let query = supabase
        .from('bills')
        .select('id, bill_number, bill_date, status, supplier:suppliers(name)', { count: 'exact' })
        .order('bill_date', { ascending: false })
        .order('bill_number', { ascending: true })
        .range(offset, offset + BILL_LIST_PAGE - 1);

      if (filters.status) query = query.eq('status', filters.status);
      if (filters.from) query = query.gte('bill_date', filters.from);
      if (filters.to) query = query.lte('bill_date', filters.to);
      if (filters.search?.trim()) {
        query = query.ilike('bill_number', `%${filters.search.trim()}%`);
      }

      const { data, error, count } = await query;
      if (error) {
        logger.error('getPrintableBills failed', { reqId, error: error.message });
        return { bills: [], total: 0 };
      }

      if (offset === 0) total = count ?? 0;

      const batch = (data ?? []).map((row) => {
        const supplier = Array.isArray(row.supplier) ? row.supplier[0] : row.supplier;
        return {
          id: row.id as string,
          bill_number: row.bill_number as string,
          bill_date: row.bill_date as string,
          status: row.status as string,
          supplier_name: (supplier as { name: string } | null)?.name ?? '',
        };
      });
      all.push(...batch);
      if (batch.length < BILL_LIST_PAGE) break;
      offset += BILL_LIST_PAGE;
    }

    return { bills: all, total };
  } catch (err) {
    logger.error('getPrintableBills error', { reqId, err });
    return { bills: [], total: 0 };
  }
}

export async function getBulkBillStickers(
  billIds: string[]
): Promise<{ id: string; bill: StickerBill; items: StickerItem[] }[]> {
  const reqId = newRequestId();
  if (billIds.length === 0) return [];

  try {
    await requireAdmin();
    const supabase = await createClient();
    const results: { id: string; bill: StickerBill; items: StickerItem[] }[] = [];
    const chunkSize = 25;

    for (let i = 0; i < billIds.length; i += chunkSize) {
      const chunk = billIds.slice(i, i + chunkSize);
      const { data, error } = await supabase
        .from('bills')
        .select(
          `id, bill_number, bill_date, total_amount,
           supplier:suppliers(name, code_prefix, code_number),
           tenant:tenants(name, gstin),
           bill_items(*, item:items(sku, name, hsn))`
        )
        .in('id', chunk);

      if (error) {
        logger.error('getBulkBillStickers failed', { reqId, error: error.message });
        throw new Error(`Could not load stickers for one or more bills: ${error.message}`);
      }

      const byId = new Map(
        (data ?? []).map((row) => {
          const supplier = Array.isArray(row.supplier) ? row.supplier[0] : row.supplier;
          const tenant = Array.isArray(row.tenant) ? row.tenant[0] : row.tenant;
          const mapped = mapBillRowToStickers({
            ...row,
            supplier: supplier as {
              name: string;
              code_prefix: string | null;
              code_number: string | null;
            } | null,
            tenant: tenant as { name: string; gstin?: string | null } | null,
            bill_items: (row.bill_items ?? []) as {
              name: string;
              hsn: string | null;
              qty: number | string | null;
              ma_price: number | string | null;
              dna_price: number | string | null;
              item?: { hsn?: string | null } | null;
            }[],
          });
          return [row.id as string, mapped] as const;
        })
      );

      for (const id of chunk) {
        const mapped = byId.get(id);
        if (mapped) results.push({ id, ...mapped });
      }
    }

    return results;
  } catch (err) {
    logger.error('getBulkBillStickers error', { reqId, err });
    throw err instanceof Error ? err : new Error('Could not load bill stickers');
  }
}

export async function markBillsPrinted(billIds: string[]): Promise<ActionResult<{ count: number }>> {
  const reqId = newRequestId();
  try {
    await requireUser();
    if (billIds.length === 0) return ok({ count: 0 });

    const supabase = await createClient();
    let count = 0;
    const chunkSize = 100;

    for (let i = 0; i < billIds.length; i += chunkSize) {
      const chunk = billIds.slice(i, i + chunkSize);
      const { error } = await supabase
        .from('bills')
        .update({ status: 'printed' })
        .in('id', chunk);

      if (error) {
        logger.error('markBillsPrinted failed', { reqId, error: error.message });
        return fail(error.message);
      }
      count += chunk.length;
    }

    revalidatePath('/admin/bills');
    revalidatePath('/admin/print');
    revalidatePath('/supplier');
    revalidatePath('/supplier/bills');
    logger.info('markBillsPrinted success', { reqId, count });
    return ok({ count });
  } catch (err) {
    logger.error('markBillsPrinted error', { reqId, err });
    return fail('Mark printed failed');
  }
}

export async function getBillStickers(
  id: string
): Promise<{ bill: StickerBill; items: StickerItem[] } | null> {
  const reqId = newRequestId();
  try {
    await requireUser();
    const supabase = await createClient();

    const { data: bill, error } = await supabase
      .from('bills')
      .select(
        `*,
         supplier:suppliers(name, code_prefix, code_number),
         tenant:tenants(name, gstin),
         bill_items(*, item:items(sku, name, hsn))`
      )
      .eq('id', id)
      .single();

    if (error || !bill) {
      logger.warn('getBillStickers not found', { reqId, id });
      return null;
    }

    const rawItems = (bill.bill_items ?? []) as {
      name: string;
      hsn: string | null;
      qty: number | string | null;
      ma_price: number | string | null;
      dna_price: number | string | null;
      item?: { hsn?: string | null } | null;
    }[];

    const mapped = mapBillRowToStickers({
      bill_number: bill.bill_number,
      bill_date: bill.bill_date,
      total_amount: bill.total_amount,
      supplier: (bill.supplier as {
        name: string;
        code_prefix: string | null;
        code_number: string | null;
      } | null) ?? null,
      tenant: (bill.tenant as { name: string; gstin?: string | null } | null) ?? null,
      bill_items: rawItems,
    });

    return mapped;
  } catch (err) {
    logger.error('getBillStickers error', { reqId, err });
    return null;
  }
}

export async function previewTallyBill(input: {
  fileName: string;
  fileType: 'xml' | 'xlsx' | 'xls' | 'pdf';
  fileContent?: string;
  storagePath?: string;
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

    // NOTE: do NOT delete the storage object here. The form retains
    // `storagePath` and re-passes it to `importTallyBill` when the user
    // confirms. The object is deleted by the import action (after parse) or
    // by the form (on cancel/replace), and the daily pg_cron job sweeps any
    // orphans.
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

type ResolvedImport = {
  fileType: 'xml' | 'xlsx' | 'xls' | 'pdf';
  text?: string;
  buffer?: Buffer;
};

/**
 * Materialize the file bytes from either an inline `fileContent` payload or a
 * Storage `storagePath`. Throws on missing/invalid input so callers can
 * surface a clean error.
 */
async function resolveTallyBytes(parsed: {
  fileType: 'xml' | 'xlsx' | 'xls' | 'pdf';
  fileContent?: string;
  storagePath?: string;
}): Promise<ResolvedImport> {
  if (parsed.storagePath) {
    const { buffer } = await fetchTallyUpload(parsed.storagePath);
    if (parsed.fileType === 'xml') {
      return { fileType: parsed.fileType, text: buffer.toString('utf-8'), buffer };
    }
    return { fileType: parsed.fileType, buffer };
  }
  if (!parsed.fileContent) {
    throw new Error('No file content provided');
  }
  if (parsed.fileType === 'xml') {
    return { fileType: parsed.fileType, text: parsed.fileContent };
  }
  return {
    fileType: parsed.fileType,
    buffer: Buffer.from(parsed.fileContent, 'base64'),
  };
}

async function parseTallyImport(parsed: {
  fileType: 'xml' | 'xlsx' | 'xls' | 'pdf';
  fileContent?: string;
  storagePath?: string;
  mappingId?: string;
}) {
  const resolved = await resolveTallyBytes(parsed);
  if (resolved.fileType === 'xml' && resolved.text) {
    return parseTallyXml(resolved.text);
  }
  if (resolved.fileType === 'pdf' && resolved.buffer) {
    return parseTallyPdf(resolved.buffer);
  }
  if (!resolved.buffer) {
    throw new Error('Could not read file contents');
  }
  const supabase = await createClient();
  const mappingId = parsed.mappingId ?? DEFAULT_TALLY_MAPPING_ID;
  const { data: mapping } = await supabase
    .from('tally_column_mappings')
    .select('column_map')
    .eq('id', mappingId)
    .single();
  if (!mapping) throw new Error('Column mapping not found');
  return parseTallyXlsx(resolved.buffer, mapping.column_map as Record<string, string>);
}

export async function importTallyBill(
  input: {
    fileName: string;
    fileType: 'xml' | 'xlsx' | 'xls' | 'pdf';
    fileContent?: string;
    storagePath?: string;
    mappingId?: string;
    supplierId?: string;
    replaceExisting?: boolean;
  }
): Promise<ActionResult<{ billId: string; itemCount: number; replaced?: boolean }>> {
  const reqId = newRequestId();
  let storagePath: string | undefined;
  try {
    const user = await requireUser();
    const parsed = TallyImportInputSchema.safeParse(input);
    if (!parsed.success) return fromZod(parsed.error);

    storagePath = parsed.data.storagePath;

    const supplierId =
      user.role === 'admin' ? input.supplierId ?? user.supplier_id : user.supplier_id;
    if (!supplierId) return fail('Supplier ID required', 'VALIDATION_ERROR');

    const parsedBill = await parseTallyImport({
      fileType: parsed.data.fileType,
      fileContent: parsed.data.fileContent,
      storagePath: parsed.data.storagePath,
      mappingId: parsed.data.mappingId,
    });
    const billData = parsedBill.bill;
    const items = parsedBill.items;

    const mappingId = parsed.data.mappingId ?? DEFAULT_TALLY_MAPPING_ID;

    const supabase = await createClient();

    const { data: existing } = await supabase
      .from('bills')
      .select('id, status, supplier:suppliers(name)')
      .eq('supplier_id', supplierId)
      .eq('bill_number', billData.number)
      .maybeSingle();

    if (existing) {
      const supplierName =
        (existing.supplier as { name?: string } | null)?.name ?? 'this supplier';

      if (!input.replaceExisting) {
        logger.info('importTallyBill duplicate', {
          reqId,
          existingBillId: existing.id,
          billNumber: billData.number,
        });
        return fail(
          `Bill ${billData.number} already exists for ${supplierName}. Open it from Bills, or replace it to re-import.`,
          'DUPLICATE_BILL',
          {
            existingBillId: existing.id,
            existingStatus: existing.status,
            billNumber: billData.number,
            supplierName,
          }
        );
      }

      const { error: deleteError } = await supabase.from('bills').delete().eq('id', existing.id);
      if (deleteError) {
        logger.error('importTallyBill replace delete failed', {
          reqId,
          existingBillId: existing.id,
          error: deleteError.message,
        });
        return fail(`Could not replace existing bill: ${deleteError.message}`);
      }

      await writeAudit('replace', 'bill', existing.id, {
        billNumber: billData.number,
        supplierId,
      });
    }

    const { data: bill, error: billError } = await supabase
      .from('bills')
      .insert({
        supplier_id: supplierId,
        bill_number: billData.number,
        bill_date: billData.date,
        // Placeholder — the trigger computes line-item totals after the
        // bill_items INSERT below; we then refresh bills.total_amount to match.
        total_amount: 0,
        status: 'imported',
      })
      .select('id')
      .single();

    if (billError || !bill) {
      logger.error('importTallyBill bill insert failed', { reqId, error: billError?.message });
      if (billError?.code === '23505') {
        return fail(
          `Bill ${billData.number} already exists for this supplier. Refresh and try again.`,
          'DUPLICATE_BILL',
          { billNumber: billData.number }
        );
      }
      return fail(billError?.message ?? 'Failed to create bill');
    }

    const billItems = items.map((item) => ({
      bill_id: bill.id,
      sku: item.sku,
      name: item.name,
      hsn: item.hsn ?? null,
      qty: item.qty,
      rate: item.rate,
    }));

    const { error: itemsError } = await supabase.from('bill_items').insert(billItems);
    if (itemsError) {
      logger.error('importTallyBill items insert failed', { reqId, error: itemsError.message });
      return fail(itemsError.message);
    }

    // Refresh bills.total_amount from the line-item totals (computed by the
    // trigger). This guarantees the header matches the sticker math regardless
    // of what the parser thought the grand total was.
    const { data: sumRow } = await supabase
      .from('bill_items')
      .select('total')
      .eq('bill_id', bill.id);
    const computedTotal = (sumRow ?? []).reduce((s, r) => s + Number(r.total ?? 0), 0);
    await supabase
      .from('bills')
      .update({ total_amount: Math.round(computedTotal * 100) / 100 })
      .eq('id', bill.id);

    await supabase.from('tally_imports').insert({
      supplier_id: supplierId,
      file_name: parsed.data.fileName,
      file_type: parsed.data.fileType,
      mapping_id: mappingId,
      status: 'completed',
    });

    await writeAudit('import', 'bill', bill.id, {
      fileName: parsed.data.fileName,
      itemCount: items.length,
      replaced: Boolean(existing),
    });

    logger.info('importTallyBill success', {
      reqId,
      billId: bill.id,
      itemCount: items.length,
      replaced: Boolean(existing),
    });
    revalidatePath('/admin/bills');
    revalidatePath('/supplier');
    revalidatePath('/supplier/bills');

    return ok({ billId: bill.id, itemCount: items.length, replaced: Boolean(existing) });
  } catch (err) {
    logger.error('importTallyBill error', { reqId, err });
    return fail('Import failed');
  } finally {
    // Free the Storage object whether the import succeeded, failed, or hit a
    // duplicate. Orphan sweeps (pg_cron) are a safety net, not the primary
    // path.
    if (storagePath) await deleteTallyUpload(storagePath);
  }
}

export async function cancelBill(id: string): Promise<ActionResult<{ id: string }>> {
  const reqId = newRequestId();
  try {
    await requireAdmin();
    const supabase = await createClient();

    const { data: existing, error: fetchErr } = await supabase
      .from('bills')
      .select('id, status')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) {
      logger.error('cancelBill fetch failed', { reqId, error: fetchErr.message });
      return fail(fetchErr.message);
    }
    if (!existing) {
      return fail('Bill not found');
    }
    if (existing.status === 'cancelled') {
      return fail('Bill is already cancelled');
    }

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

export type BillForEdit = {
  id: string;
  supplierId: string;
  billNumber: string;
  billDate: string;
  items: {
    id: string;
    description: string;
    hsn: string;
    qty: number;
    rate: number;
  }[];
};

export async function getBillForEdit(id: string): Promise<BillForEdit | null> {
  const reqId = newRequestId();
  try {
    await requireAdmin();
    const supabase = await createClient();

    const { data: bill, error } = await supabase
      .from('bills')
      .select('id, supplier_id, bill_number, bill_date, bill_items(id, name, hsn, qty, rate)')
      .eq('id', id)
      .single();

    if (error || !bill) {
      logger.warn('getBillForEdit not found', { reqId, id, error: error?.message });
      return null;
    }

    const items = (bill.bill_items ?? []) as {
      id: string;
      name: string;
      hsn: string | null;
      qty: number | string | null;
      rate: number | string | null;
    }[];

    return {
      id: bill.id,
      supplierId: bill.supplier_id,
      billNumber: bill.bill_number,
      billDate: bill.bill_date,
      items: items.map((i) => ({
        id: i.id,
        description: i.name,
        hsn: i.hsn ?? '',
        qty: Number(i.qty ?? 0),
        rate: Number(i.rate ?? 0),
      })),
    };
  } catch (err) {
    logger.error('getBillForEdit error', { reqId, err });
    return null;
  }
}

export async function updateManualBill(input: {
  billId: string;
  billNumber: string;
  billDate: string;
  items: { description: string; hsn?: string; qty: number; rate: number }[];
}): Promise<ActionResult<{ billId: string; itemCount: number }>> {
  const reqId = newRequestId();
  try {
    await requireAdmin();
    const supabase = await createClient();

    const parsed = ManualBillInputSchema.safeParse({
      supplierId: '00000000-0000-0000-0000-000000000000',
      billNumber: input.billNumber,
      billDate: input.billDate,
      items: input.items,
    });
    if (!parsed.success) return fromZod(parsed.error);

    const { data: bill, error: billFetchErr } = await supabase
      .from('bills')
      .select('id, supplier_id, bill_number, status')
      .eq('id', input.billId)
      .single();

    if (billFetchErr || !bill) {
      logger.warn('updateManualBill not found', { reqId, id: input.billId });
      return fail('Bill not found');
    }

    const newNumber = parsed.data.billNumber.trim();
    if (bill.bill_number !== newNumber) {
      const { data: dup } = await supabase
        .from('bills')
        .select('id')
        .eq('supplier_id', bill.supplier_id)
        .eq('bill_number', newNumber)
        .neq('id', input.billId)
        .maybeSingle();

      if (dup) {
        return fail(
          `Bill ${newNumber} already exists for this supplier. Pick a different bill number.`,
          'DUPLICATE_BILL',
          { billNumber: newNumber }
        );
      }
    }

    const totalAmount = parsed.data.items.reduce((sum, i) => sum + i.qty * i.rate, 0);

    // Preserve status — editing a line item must not reset a 'printed' bill
    // back to 'imported' (which would re-queue it for bulk print). Only flip
    // 'draft' → 'imported'; leave 'printed' / 'cancelled' as-is.
    const nextStatus = bill.status === 'draft' ? 'imported' : bill.status;

    const { error: billUpdErr } = await supabase
      .from('bills')
      .update({
        bill_number: newNumber,
        bill_date: parsed.data.billDate,
        total_amount: totalAmount,
        status: nextStatus,
      })
      .eq('id', input.billId);

    if (billUpdErr) {
      logger.error('updateManualBill bill update failed', { reqId, error: billUpdErr.message });
      if (billUpdErr.code === '23505') {
        return fail(
          `Bill ${newNumber} already exists for this supplier.`,
          'DUPLICATE_BILL',
          { billNumber: newNumber }
        );
      }
      return fail(billUpdErr.message);
    }

    const { error: itemsDeleteErr } = await supabase
      .from('bill_items')
      .delete()
      .eq('bill_id', input.billId);

    if (itemsDeleteErr) {
      logger.error('updateManualBill items delete failed', { reqId, error: itemsDeleteErr.message });
      return fail(itemsDeleteErr.message);
    }

    const billItems = parsed.data.items.map((item) => ({
      bill_id: input.billId,
      sku: item.description.slice(0, 40).toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'ITEM',
      name: item.description,
      hsn: item.hsn?.trim() || null,
      qty: item.qty,
      rate: item.rate,
    }));

    const { error: itemsInsertErr } = await supabase.from('bill_items').insert(billItems);
    if (itemsInsertErr) {
      logger.error('updateManualBill items insert failed', { reqId, error: itemsInsertErr.message });
      return fail(itemsInsertErr.message);
    }

    await writeAudit('manual_edit', 'bill', input.billId, {
      billNumber: newNumber,
      itemCount: parsed.data.items.length,
    });

    logger.info('updateManualBill success', { reqId, billId: input.billId, itemCount: parsed.data.items.length });
    revalidatePath('/admin/bills');
    revalidatePath(`/admin/bills/${input.billId}`);

    return ok({ billId: input.billId, itemCount: parsed.data.items.length });
  } catch (err) {
    logger.error('updateManualBill error', { reqId, err });
    return fail('Bill update failed');
  }
}

export async function deleteBill(id: string): Promise<ActionResult<{ id: string }>> {
  const reqId = newRequestId();
  try {
    const user = await requireUser();
    const supabase = await createClient();

    const { data: bill, error: fetchErr } = await supabase
      .from('bills')
      .select('id, bill_number, supplier_id')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) {
      logger.error('deleteBill fetch failed', { reqId, error: fetchErr.message });
      return fail(fetchErr.message);
    }
    if (!bill) {
      return fail('Bill not found');
    }
    if (user.role === 'supplier' && bill.supplier_id !== user.supplier_id) {
      return fail('Not authorized to delete this bill');
    }

    const { error } = await supabase.from('bills').delete().eq('id', id);
    if (error) {
      logger.error('deleteBill failed', { reqId, error: error.message });
      return fail(error.message);
    }

    await writeAudit('delete', 'bill', id, {
      billNumber: bill.bill_number,
      supplierId: bill.supplier_id,
    });

    logger.info('deleteBill success', { reqId, id });
    revalidatePath('/admin/bills');
    revalidatePath('/admin/print');
    revalidatePath('/supplier');
    revalidatePath('/supplier/bills');
    revalidatePath('/supplier/print');

    return ok({ id });
  } catch (err) {
    logger.error('deleteBill error', { reqId, err });
    return fail('Delete failed');
  }
}

export async function deleteBillAction(id: string): Promise<void> {
  await deleteBill(id);
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
    revalidatePath('/supplier/bills');

    return ok({ id });
  } catch (err) {
    logger.error('markBillPrinted error', { reqId, err });
    return fail('Mark printed failed');
  }
}

export async function createManualBill(input: {
  supplierId: string;
  billNumber: string;
  billDate: string;
  items: { description: string; hsn?: string; qty: number; rate: number }[];
}): Promise<ActionResult<{ billId: string; itemCount: number }>> {
  const reqId = newRequestId();
  try {
    const user = await requireUser();
    const supplierId = user.role === 'admin' ? input.supplierId : user.supplier_id;
    if (!supplierId) return fail('Supplier ID required', 'VALIDATION_ERROR');

    const parsed = ManualBillInputSchema.safeParse({
      supplierId,
      billNumber: input.billNumber,
      billDate: input.billDate,
      items: input.items,
    });
    if (!parsed.success) return fromZod(parsed.error);

    const supabase = await createClient();

    const { data: existing } = await supabase
      .from('bills')
      .select('id')
      .eq('supplier_id', supplierId)
      .eq('bill_number', parsed.data.billNumber)
      .maybeSingle();

    if (existing) {
      return fail(
        `Bill ${parsed.data.billNumber} already exists for this supplier. Use a different bill number or delete the existing one first.`,
        'DUPLICATE_BILL',
        { existingBillId: existing.id, billNumber: parsed.data.billNumber }
      );
    }

    const totalAmount = parsed.data.items.reduce((sum, i) => sum + i.qty * i.rate, 0);

    const { data: bill, error: billError } = await supabase
      .from('bills')
      .insert({
        supplier_id: supplierId,
        bill_number: parsed.data.billNumber,
        bill_date: parsed.data.billDate,
        total_amount: totalAmount,
        status: 'imported',
      })
      .select('id')
      .single();

    if (billError || !bill) {
      logger.error('createManualBill bill insert failed', { reqId, error: billError?.message });
      if (billError?.code === '23505') {
        return fail(
          `Bill ${parsed.data.billNumber} already exists for this supplier.`,
          'DUPLICATE_BILL',
          { billNumber: parsed.data.billNumber }
        );
      }
      return fail(billError?.message ?? 'Failed to create bill');
    }

    const billItems = parsed.data.items.map((item) => ({
      bill_id: bill.id,
      sku: item.description.slice(0, 40).toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'ITEM',
      name: item.description,
      hsn: item.hsn?.trim() || null,
      qty: item.qty,
      rate: item.rate,
    }));

    const { error: itemsError } = await supabase.from('bill_items').insert(billItems);
    if (itemsError) {
      logger.error('createManualBill items insert failed', { reqId, error: itemsError.message });
      await supabase.from('bills').delete().eq('id', bill.id);
      return fail(itemsError.message);
    }

    await writeAudit('manual_import', 'bill', bill.id, {
      billNumber: parsed.data.billNumber,
      itemCount: parsed.data.items.length,
    });

    logger.info('createManualBill success', { reqId, billId: bill.id, itemCount: parsed.data.items.length });
    revalidatePath('/admin/bills');
    revalidatePath('/supplier');
    revalidatePath('/supplier/bills');

    return ok({ billId: bill.id, itemCount: parsed.data.items.length });
  } catch (err) {
    logger.error('createManualBill error', { reqId, err });
    return fail('Manual bill creation failed');
  }
}

/**
 * Re-applies the supplier's current pricing formula to every line item on the
 * bill. The DB trigger `compute_bill_item_pricing` only runs on INSERT, so when
 * a supplier's MA/DNA markups change after a bill is imported, the stored
 * prices stay stale. This action mirrors the SQL trigger in TypeScript and
 * updates each line in place. `bills.total_amount` is left as-is to preserve
 * the original Tally invoice total.
 */
export async function recomputeBillPricing(
  id: string
): Promise<ActionResult<{ updated: number; hsnUpdated: number }>> {
  const reqId = newRequestId();
  try {
    await requireAdmin();
    const supabase = await createClient();

    const { data: bill, error: billErr } = await supabase
      .from('bills')
      .select('id, supplier_id, bill_items(id, rate, qty, name, hsn)')
      .eq('id', id)
      .single();

    if (billErr || !bill) {
      logger.warn('recomputeBillPricing not found', { reqId, id, error: billErr?.message });
      return fail(billErr?.message ?? 'Bill not found');
    }

    const { data: rule, error: ruleErr } = await supabase
      .from('pricing_rules')
      .select('ma_markup1_pct, ma_markup2_pct, dna_markup1_pct, dna_markup2_pct, gst_pct')
      .eq('supplier_id', bill.supplier_id)
      .maybeSingle();

    if (ruleErr) {
      logger.error('recomputeBillPricing rule fetch failed', { reqId, error: ruleErr.message });
      return fail(ruleErr.message);
    }
    if (!rule) {
      return fail(
        'No pricing formula set for this supplier. Set MA/DNA markups under Suppliers → Formula first.',
        'NO_PRICING_RULE'
      );
    }

    const pricingRule = {
      ma_markup1_pct: Number(rule.ma_markup1_pct) || 0,
      ma_markup2_pct: Number(rule.ma_markup2_pct) || 0,
      dna_markup1_pct: Number(rule.dna_markup1_pct) || 0,
      dna_markup2_pct: Number(rule.dna_markup2_pct) || 0,
      gst_pct: Number(rule.gst_pct) || 0,
    };

    const rows = (bill.bill_items ?? []) as {
      id: string;
      rate: number | string;
      qty: number | string;
      name: string;
      hsn: string | null;
    }[];

    let updated = 0;
    let hsnUpdated = 0;
    for (const row of rows) {
      const rate = Number(row.rate ?? 0);
      const qty = Number(row.qty ?? 1);
      const ma = round2(calcMA(rate, pricingRule));
      const dna = round2(calcDNA(rate, pricingRule));
      const taxable = round2(ma * qty);
      const gstAmount = (taxable * pricingRule.gst_pct) / 100;
      const cgst = round2(gstAmount / 2);
      const sgst = round2(gstAmount / 2);
      const total = round2(taxable + gstAmount);

      const extractedHsn = !row.hsn
        ? extractHsnFromDescription(row.name)
        : undefined;

      const { error: updErr } = await supabase
        .from('bill_items')
        .update({
          ma_price: ma,
          dna_price: dna,
          unit_price: ma,
          taxable,
          cgst,
          sgst,
          igst: 0,
          total,
          ...(extractedHsn ? { hsn: extractedHsn } : {}),
        })
        .eq('id', row.id);

      if (updErr) {
        logger.error('recomputeBillPricing item update failed', {
          reqId,
          rowId: row.id,
          error: updErr.message,
        });
        return fail(updErr.message);
      }
      if (extractedHsn) hsnUpdated += 1;
      updated += 1;
    }

    // Refresh bills.total_amount from the recomputed line-item totals so the
    // header always matches the sticker math — never the parsed-PDF value.
    const { data: sumRows } = await supabase
      .from('bill_items')
      .select('total')
      .eq('bill_id', id);
    const recomputedTotal = (sumRows ?? []).reduce(
      (s, r) => s + Number(r.total ?? 0),
      0
    );
    await supabase
      .from('bills')
      .update({ total_amount: Math.round(recomputedTotal * 100) / 100 })
      .eq('id', id);

    await writeAudit('recompute_pricing', 'bill', id, {
      itemCount: updated,
      hsnUpdated,
      formula: pricingRule,
    });

    logger.info('recomputeBillPricing success', { reqId, id, updated, hsnUpdated });
    revalidatePath('/admin/bills');
    revalidatePath(`/admin/bills/${id}`);

    return ok({ updated, hsnUpdated });
  } catch (err) {
    logger.error('recomputeBillPricing error', { reqId, err });
    return fail('Recompute failed');
  }
}
