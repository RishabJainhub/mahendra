import { IndianRupee } from 'lucide-react';
import { getPricingRules, getSuppliers } from '@/app/actions/suppliers';
import { PricingTable } from './pricing-table';
import { PageHeader, PageShell } from '@/components/layout/page-header';
import { ButtonLink } from '@/components/ui/button-link';
import { EmptyState } from '@/components/layout/empty-state';

export default async function AdminPricingPage() {
  const suppliers = await getSuppliers();
  const rules = await getPricingRules();
  const ruleMap = new Map(rules.map((r) => [r.supplier_id, r]));

  const rows = suppliers.map((s) => {
    const rule = ruleMap.get(s.id);
    return {
      id: s.id as string,
      name: s.name as string,
      active: Boolean(s.active),
      rule: rule
        ? {
            ma_markup1_pct: Number(rule.ma_markup1_pct) || 0,
            ma_markup2_pct: Number(rule.ma_markup2_pct) || 0,
            dna_markup1_pct: Number(rule.dna_markup1_pct) || 0,
            dna_markup2_pct: Number(rule.dna_markup2_pct) || 0,
            gst_pct: Number(rule.gst_pct) || 5,
          }
        : null,
    };
  });

  return (
    <PageShell>
      <PageHeader
        title="Pricing formulas"
        description="One formula per supplier converts purchase rates into MA and DNA sticker prices. The ₹1,000 columns show each formula in action."
      >
        <ButtonLink href="/admin/suppliers" variant="outline">
          Manage suppliers
        </ButtonLink>
      </PageHeader>

      {rows.length === 0 ? (
        <EmptyState
          icon={<IndianRupee className="h-10 w-10" />}
          title="No suppliers to price"
          description="Add a supplier first, then assign their MA and DNA markups here."
        />
      ) : (
        <PricingTable suppliers={rows} />
      )}
    </PageShell>
  );
}
