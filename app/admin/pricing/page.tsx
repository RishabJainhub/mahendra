import { getPricingRules, getSuppliers } from '@/app/actions/suppliers';
import { PricingForm } from './pricing-form';

export default async function AdminPricingPage() {
  const suppliers = await getSuppliers();
  const rules = await getPricingRules();
  const ruleMap = new Map(rules.map((r) => [r.supplier_id, r]));

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Pricing Rules</h1>
      <div className="space-y-6">
        {suppliers.map((supplier) => (
          <PricingForm
            key={supplier.id}
            supplierId={supplier.id}
            supplierName={supplier.name}
            rule={ruleMap.get(supplier.id)}
          />
        ))}
      </div>
    </div>
  );
}
