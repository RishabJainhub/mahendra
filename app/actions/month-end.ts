'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/auth';
import { ok, fail, type ActionResult } from '@/lib/result';
import { logger, newRequestId } from '@/lib/logger';
import { writeAudit } from '@/lib/audit';
import { buildMonthlyWorkbook, monthBounds } from '@/lib/export/monthly-bills';

const PAGE_SIZE = 500;

type BillRecord = {
  id: string;
  bill_number: string;
  bill_date: string;
  status: string;
  total_amount: number | string;
  supplier: {
    name: string;
    code_prefix: string | null;
    code_number: string | null;
  } | null;
};

type BillItemRecord = {
  bill_id: string;
  sku: string;
  name: string;
  hsn: string | null;
  qty: number | string;
  rate: number | string;
  ma_price: number | string;
  dna_price: number | string;
  taxable: number | string;
  cgst: number | string;
  sgst: number | string;
  igst: number | string;
  total: number | string;
};

async function fetchBillsForMonth(bounds: { start: string; end: string }): Promise<BillRecord[]> {
  const supabase = await createClient();
  const all: BillRecord[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('bills')
      .select(
        'id, bill_number, bill_date, status, total_amount, supplier:suppliers(name, code_prefix, code_number)'
      )
      .gte('bill_date', bounds.start)
      .lte('bill_date', bounds.end)
      .order('bill_date', { ascending: true })
      .order('bill_number', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw new Error(error.message);
    const batch = (data ?? []).map((row) => ({
      ...row,
      supplier: Array.isArray(row.supplier) ? row.supplier[0] ?? null : row.supplier,
    })) as BillRecord[];
    all.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return all;
}

async function fetchBillItems(billIds: string[]): Promise<Map<string, BillItemRecord[]>> {
  const supabase = await createClient();
  const map = new Map<string, BillItemRecord[]>();
  if (billIds.length === 0) return map;

  const chunkSize = 100;
  for (let i = 0; i < billIds.length; i += chunkSize) {
    const chunk = billIds.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from('bill_items')
      .select(
        'bill_id, sku, name, hsn, qty, rate, ma_price, dna_price, taxable, cgst, sgst, igst, total'
      )
      .in('bill_id', chunk);

    if (error) throw new Error(error.message);

    for (const row of (data ?? []) as BillItemRecord[]) {
      const list = map.get(row.bill_id) ?? [];
      list.push(row);
      map.set(row.bill_id, list);
    }
  }

  return map;
}

export type MonthEndSummary = {
  month: string;
  billCount: number;
  lineItemCount: number;
  totalInr: number;
  exported: boolean;
  exportedAt: string | null;
};

async function hasMonthExport(month: string): Promise<{ exported: boolean; exportedAt: string | null }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('tenant_month_exports')
    .select('exported_at')
    .eq('month', month)
    .maybeSingle();

  if (error) {
    logger.warn('hasMonthExport query failed', { error: error.message, month });
    return { exported: false, exportedAt: null };
  }

  return {
    exported: Boolean(data),
    exportedAt: data?.exported_at ?? null,
  };
}

async function countLineItemsForBills(billIds: string[]): Promise<number> {
  if (billIds.length === 0) return 0;
  const supabase = await createClient();
  let total = 0;
  const chunkSize = 100;

  for (let i = 0; i < billIds.length; i += chunkSize) {
    const chunk = billIds.slice(i, i + chunkSize);
    const { count, error } = await supabase
      .from('bill_items')
      .select('id', { count: 'exact', head: true })
      .in('bill_id', chunk);

    if (error) throw new Error(`Line items: ${error.message}`);
    total += count ?? 0;
  }

  return total;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export async function recordMonthExport(month: string): Promise<ActionResult<{ month: string }>> {
  const reqId = newRequestId();
  try {
    const admin = await requireAdmin();
    const bounds = monthBounds(month);
    if (!bounds) return fail('Use month format YYYY-MM (e.g. 2026-06)');

    const supabase = await createClient();
    const { error } = await supabase.from('tenant_month_exports').upsert(
      {
        tenant_id: admin.tenant_id,
        month: bounds.label,
        exported_at: new Date().toISOString(),
        exported_by: admin.id,
      },
      { onConflict: 'tenant_id,month' }
    );

    if (error) {
      logger.error('recordMonthExport failed', { reqId, error: error.message });
      return fail(error.message);
    }

    await writeAudit('export', 'month', null, { month: bounds.label });
    revalidatePath('/admin');
    revalidatePath('/admin/settings');
    return ok({ month: bounds.label });
  } catch (err) {
    logger.error('recordMonthExport error', { reqId, err });
    return fail('Could not record export');
  }
}

export async function getMonthEndSummary(month: string): Promise<ActionResult<MonthEndSummary>> {
  const reqId = newRequestId();
  try {
    await requireAdmin();
    const bounds = monthBounds(month);
    if (!bounds) return fail('Use month format YYYY-MM (e.g. 2026-06)');

    const supabase = await createClient();
    const { data: bills, error: billsError } = await supabase
      .from('bills')
      .select('id, total_amount')
      .gte('bill_date', bounds.start)
      .lte('bill_date', bounds.end);

    if (billsError) {
      logger.error('getMonthEndSummary bills failed', { reqId, error: billsError.message });
      return fail(`Could not load bills: ${billsError.message}`);
    }

    const billIds = (bills ?? []).map((b) => b.id as string);
    const lineItemCount = await countLineItemsForBills(billIds);
    const totalInr = (bills ?? []).reduce((sum, b) => sum + Number(b.total_amount), 0);
    const exportStatus = await hasMonthExport(bounds.label);

    return ok({
      month: bounds.label,
      billCount: billIds.length,
      lineItemCount,
      totalInr: Math.round(totalInr * 100) / 100,
      exported: exportStatus.exported,
      exportedAt: exportStatus.exportedAt,
    });
  } catch (err) {
    const message = errorMessage(err);
    logger.error('getMonthEndSummary error', { reqId, error: message });
    if (message === 'Unauthorized' || message === 'Forbidden') {
      return fail('Session expired — sign out and sign in again.');
    }
    return fail(`Could not load month summary: ${message}`);
  }
}

export async function exportMonthToExcel(month: string): Promise<ActionResult<{ base64: string; fileName: string }>> {
  const reqId = newRequestId();
  try {
    await requireAdmin();
    const bounds = monthBounds(month);
    if (!bounds) return fail('Use month format YYYY-MM (e.g. 2026-06)');

    const bills = await fetchBillsForMonth(bounds);
    if (bills.length === 0) {
      return fail(`No bills found for ${bounds.label}`);
    }

    const itemsByBillId = await fetchBillItems(bills.map((b) => b.id));
    const buffer = buildMonthlyWorkbook(bills, itemsByBillId);
    const fileName = `mahendra-bills-${bounds.label}.xlsx`;

    await writeAudit('export', 'month', null, {
      month: bounds.label,
      billCount: bills.length,
      lineItemCount: Array.from(itemsByBillId.values()).reduce((n, rows) => n + rows.length, 0),
    });

    logger.info('exportMonthToExcel success', { reqId, month: bounds.label, bills: bills.length });
    return ok({ base64: buffer.toString('base64'), fileName });
  } catch (err) {
    logger.error('exportMonthToExcel error', { reqId, err });
    return fail('Export failed');
  }
}

export async function closeMonth(
  month: string,
  confirmText: string
): Promise<ActionResult<{ deletedBills: number }>> {
  const reqId = newRequestId();
  try {
    await requireAdmin();
    const bounds = monthBounds(month);
    if (!bounds) return fail('Use month format YYYY-MM (e.g. 2026-06)');

    const expected = `CLOSE ${bounds.label}`;
    if (confirmText.trim() !== expected) {
      return fail(`Type exactly "${expected}" to confirm`);
    }

    const summary = await getMonthEndSummary(bounds.label);
    if (!summary.ok) return fail(summary.error);
    if (summary.data.billCount === 0) {
      return fail(`No bills to remove for ${bounds.label}`);
    }

    const exportStatus = await hasMonthExport(bounds.label);
    if (!exportStatus.exported) {
      return fail(
        `Download the Excel export for ${bounds.label} before clearing. This ensures your records are saved.`
      );
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from('bills')
      .delete()
      .gte('bill_date', bounds.start)
      .lte('bill_date', bounds.end);

    if (error) {
      logger.error('closeMonth delete failed', { reqId, error: error.message });
      return fail(error.message);
    }

    await writeAudit('close_month', 'month', null, {
      month: bounds.label,
      deletedBills: summary.data.billCount,
      deletedLineItems: summary.data.lineItemCount,
      totalInr: summary.data.totalInr,
    });

    logger.info('closeMonth success', {
      reqId,
      month: bounds.label,
      deletedBills: summary.data.billCount,
    });

    revalidatePath('/admin');
    revalidatePath('/admin/bills');
    revalidatePath('/admin/print');
    revalidatePath('/admin/settings');

    await supabase
      .from('tenant_month_exports')
      .delete()
      .eq('month', bounds.label);

    return ok({ deletedBills: summary.data.billCount });
  } catch (err) {
    logger.error('closeMonth error', { reqId, err });
    return fail('Could not close month');
  }
}

/** Used by API route — same fetch/build path without base64 round-trip. */
export async function buildMonthExportBuffer(month: string): Promise<{
  buffer: Buffer;
  fileName: string;
  billCount: number;
} | null> {
  await requireAdmin();
  const bounds = monthBounds(month);
  if (!bounds) return null;

  const bills = await fetchBillsForMonth(bounds);
  if (bills.length === 0) return null;

  const itemsByBillId = await fetchBillItems(bills.map((b) => b.id));
  const buffer = buildMonthlyWorkbook(bills, itemsByBillId);

  return {
    buffer,
    fileName: `mahendra-bills-${bounds.label}.xlsx`,
    billCount: bills.length,
  };
}
