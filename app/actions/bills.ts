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
    await requireUser();
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
    await requireUser();
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
        continue;
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
    return [];
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
    revalidatePath('/supplier/history');
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
    replaceExisting?: boolean;
  }
): Promise<ActionResult<{ billId: string; itemCount: number; replaced?: boolean }>> {
  const reqId = newRequestId();
  try {
    const user = await requireUser();
    const parsed = TallyImportInputSchema.safeParse(input);
    if (!parsed.success) return fromZod(parsed.error);

    const supplierId =
      user.role === 'admin' ? input.supplierId ?? user.supplier_id : user.supplier_id;
    if (!supplierId) return fail('Supplier ID required', 'VALIDATION_ERROR');

    const parsedBill = await parseTallyImport({
      fileType: parsed.data.fileType,
      fileContent: parsed.data.fileContent,
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
        total_amount: billData.totals.amount,
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
    revalidatePath('/supplier/history');

    return ok({ billId: bill.id, itemCount: items.length, replaced: Boolean(existing) });
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
