'use client';

import { useState } from 'react';
import { upsertPricingRule } from '@/app/actions/suppliers';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { PricingRuleFields } from '@/components/pricing/pricing-rule-fields';
import { useToast } from '@/components/ui/toast';
import { calcMA, calcDNA, formatINR } from '@/lib/pricing';
import { Pencil } from 'lucide-react';

type Rule = {
  ma_markup1_pct: number;
  ma_markup2_pct: number;
  dna_markup1_pct: number;
  dna_markup2_pct: number;
  gst_pct: number;
};

type SupplierRow = {
  id: string;
  name: string;
  active: boolean;
  rule: Rule | null;
};

const SAMPLE_RATE = 1000;

function pct(n: number): string {
  return `${Number.isInteger(n) ? n : n.toFixed(2)}%`;
}

export function PricingTable({ suppliers }: { suppliers: SupplierRow[] }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState<SupplierRow | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave(formData: FormData) {
    if (!editing) return;
    setSaving(true);
    formData.set('supplier_id', editing.id);
    const result = await upsertPricingRule(formData);
    setSaving(false);
    if (result.ok) {
      setEditing(null);
      toast({
        title: 'Formula saved',
        description: `${editing.name} — applies to bills imported from now on. Use "Refresh pricing" on older bills to update them.`,
        variant: 'success',
      });
    } else {
      toast({ title: 'Save failed', description: result.error, variant: 'destructive' });
    }
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <THead>
              <TR>
                <TH>Supplier</TH>
                <TH>MA formula</TH>
                <TH>DNA formula</TH>
                <TH align="right">GST</TH>
                <TH align="right">MA on ₹1,000</TH>
                <TH align="right">DNA on ₹1,000</TH>
                <TH align="right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {suppliers.map((s) => {
                const r = s.rule;
                const hasFormula =
                  r && (r.ma_markup1_pct || r.ma_markup2_pct || r.dna_markup1_pct || r.dna_markup2_pct);
                return (
                  <TR key={s.id}>
                    <TD>
                      <div className="font-medium">{s.name}</div>
                      {!s.active && (
                        <Badge variant="destructive" className="mt-0.5">Inactive</Badge>
                      )}
                    </TD>
                    {hasFormula && r ? (
                      <>
                        <TD className="whitespace-nowrap text-sm text-muted-foreground">
                          MU {pct(r.ma_markup1_pct)} + MU {pct(r.ma_markup2_pct)}
                        </TD>
                        <TD className="whitespace-nowrap text-sm text-muted-foreground">
                          {pct(r.dna_markup1_pct)} + MU {pct(r.dna_markup2_pct)}
                        </TD>
                        <TD align="right" className="tabular-nums text-sm">{pct(r.gst_pct)}</TD>
                        <TD align="right" className="tabular-nums font-medium">
                          {formatINR(calcMA(SAMPLE_RATE, r))}
                        </TD>
                        <TD align="right" className="tabular-nums font-medium">
                          {formatINR(calcDNA(SAMPLE_RATE, r))}
                        </TD>
                      </>
                    ) : (
                      <TD colSpan={5}>
                        <span className="text-sm text-amber-700">
                          No formula yet — sticker prices will equal the purchase rate.
                        </span>
                      </TD>
                    )}
                    <TD align="right">
                      <Button size="sm" variant="outline" onClick={() => setEditing(s)}>
                        <Pencil className="mr-1.5 h-3.5 w-3.5" />
                        {hasFormula ? 'Edit' : 'Set formula'}
                      </Button>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 text-slate-950 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Formula — {editing.name}</h2>
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(null)}>✕</Button>
            </div>
            <form action={handleSave} className="space-y-4">
              <PricingRuleFields
                showTester
                defaultValues={{
                  ma_markup1_pct: Number(editing.rule?.ma_markup1_pct) || 0,
                  ma_markup2_pct: Number(editing.rule?.ma_markup2_pct) || 0,
                  dna_markup1_pct: Number(editing.rule?.dna_markup1_pct) || 0,
                  dna_markup2_pct: Number(editing.rule?.dna_markup2_pct) || 0,
                  gst_pct: Number(editing.rule?.gst_pct) || 5,
                }}
              />
              <div className="flex gap-2 pt-1">
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving…' : 'Save formula'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
