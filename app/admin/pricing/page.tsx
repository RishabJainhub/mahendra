import { IndianRupee } from 'lucide-react';
import { getPricingRules, getSuppliers } from '@/app/actions/suppliers';
import { PricingForm } from './pricing-form';
import { PageHeader, PageShell } from '@/components/layout/page-header';
import { ButtonLink } from '@/components/ui/button-link';
import { EmptyState } from '@/components/layout/empty-state';

export default async function AdminPricingPage() {
  const suppliers = await getSuppliers();
  const rules = await getPricingRules();
  const ruleMap = new Map(rules.map((r) => [r.supplier_id, r]));

  return (
    <PageShell>
      <PageHeader
        title="Pricing formulas"
        description="Each supplier gets a formula that converts Tally rates into sticker prices on import."
      >
        <ButtonLink href="/admin/suppliers" variant="outline">
          Manage suppliers
        </ButtonLink>
      </PageHeader>

      {suppliers.length === 0 ? (
        <EmptyState
          icon={<IndianRupee className="h-10 w-10" />}
          title="No suppliers to price"
          description="Invite a supplier first, then assign their MA and DNA markups here."
        />
      ) : (
        <div className="space-y-5">
          {suppliers.map((supplier) => (
            <PricingForm
              key={supplier.id}
              supplierId={supplier.id}
              supplierName={supplier.name}
              rule={ruleMap.get(supplier.id)}
            />
          ))}
        </div>
      )}
    </PageShell>
  );
}
