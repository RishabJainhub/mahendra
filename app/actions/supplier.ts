'use server';

import { createClient } from '@/lib/supabase/server';
import { requireSupplier } from '@/lib/auth';
import { logger, newRequestId } from '@/lib/logger';

export async function getSupplierDashboard() {
  const reqId = newRequestId();
  try {
    const user = await requireSupplier();
    const supabase = await createClient();

    const { data: bills } = await supabase
      .from('bills')
      .select('*, bill_items(count)')
      .eq('supplier_id', user.supplier_id!)
      .order('created_at', { ascending: false })
      .limit(10);

    const { count: totalBills } = await supabase
      .from('bills')
      .select('*', { count: 'exact', head: true })
      .eq('supplier_id', user.supplier_id!);

    const { count: printedBills } = await supabase
      .from('bills')
      .select('*', { count: 'exact', head: true })
      .eq('supplier_id', user.supplier_id!)
      .eq('status', 'printed');

    const { data: lastImport } = await supabase
      .from('tally_imports')
      .select('*')
      .eq('supplier_id', user.supplier_id!)
      .order('id', { ascending: false })
      .limit(1)
      .single();

    const { data: pricingRule } = await supabase
      .from('pricing_rules')
      .select('*')
      .eq('supplier_id', user.supplier_id!)
      .single();

    const { data: imports } = await supabase
      .from('tally_imports')
      .select('*')
      .eq('supplier_id', user.supplier_id!)
      .order('id', { ascending: false })
      .limit(5);

    return {
      bills: bills ?? [],
      totalBills: totalBills ?? 0,
      printedBills: printedBills ?? 0,
      lastImport,
      pricingRule,
      imports: imports ?? [],
    };
  } catch (err) {
    logger.error('getSupplierDashboard error', { reqId, err });
    return {
      bills: [],
      totalBills: 0,
      printedBills: 0,
      lastImport: null,
      pricingRule: null,
      imports: [],
    };
  }
}

export async function getSupplierMappings() {
  const reqId = newRequestId();
  try {
    const user = await requireSupplier();
    const supabase = await createClient();
    const { data } = await supabase
      .from('tally_column_mappings')
      .select('*')
      .eq('tenant_id', user.tenant_id);
    return data ?? [];
  } catch (err) {
    logger.error('getSupplierMappings error', { reqId, err });
    return [];
  }
}

export async function getDefaultLayout() {
  const reqId = newRequestId();
  try {
    const user = await requireSupplier();
    const supabase = await createClient();
    const { data } = await supabase
      .from('layouts')
      .select('*')
      .eq('tenant_id', user.tenant_id)
      .limit(1)
      .single();
    return data;
  } catch (err) {
    logger.error('getDefaultLayout error', { reqId, err });
    return null;
  }
}
