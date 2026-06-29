'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Users, Pencil, UserX, UserCheck, Trash2 } from 'lucide-react';
import {
  inviteSupplier,
  updateSupplier,
  deactivateSupplier,
  activateSupplier,
  deleteSupplier,
  upsertPricingRule,
} from '@/app/actions/suppliers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PageHeader, PageShell } from '@/components/layout/page-header';
import { EmptyState } from '@/components/layout/empty-state';
import { PricingRuleFields } from '@/components/pricing/pricing-rule-fields';
import { describeFormula, formatSupplierCode } from '@/lib/pricing';
import { Label } from '@/components/ui/field';

type PricingRule = {
  ma_markup1_pct: number;
  ma_markup2_pct: number;
  dna_markup1_pct: number;
  dna_markup2_pct: number;
  gst_pct: number;
};

type Supplier = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  active: boolean;
  code_prefix: string | null;
  code_number: string | null;
  pricing_rule?: PricingRule | null;
};

type InviteSuccess = {
  tempPassword: string;
  formulaSummary: string;
};

export function SuppliersClient({ suppliers }: { suppliers: Supplier[] }) {
  const [showInvite, setShowInvite] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [formulaTarget, setFormulaTarget] = useState<Supplier | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<InviteSuccess | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Supplier | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleInvite(formData: FormData) {
    setLoading(true);
    setError(null);
    const result = await inviteSupplier(formData);
    setLoading(false);
    if (result.ok) {
      setInviteSuccess({
        tempPassword: result.data.tempPassword,
        formulaSummary: result.data.formulaSummary,
      });
      setShowInvite(false);
      setMessage('Supplier invited successfully.');
    } else {
      setError(result.error);
    }
  }

  async function handleUpdate(formData: FormData) {
    if (!editing) return;
    setLoading(true);
    setError(null);
    const result = await updateSupplier(editing.id, {
      name: String(formData.get('name') ?? ''),
      email: String(formData.get('email') ?? ''),
      phone: String(formData.get('phone') ?? '') || undefined,
      code_prefix: String(formData.get('code_prefix') ?? '') || undefined,
      code_number: String(formData.get('code_number') ?? '') || undefined,
    });
    setLoading(false);
    if (result.ok) {
      setEditing(null);
      setMessage('Supplier updated.');
    } else {
      setError(result.error);
    }
  }

  async function handleFormulaSave(formData: FormData) {
    if (!formulaTarget) return;
    setLoading(true);
    setError(null);
    formData.set('supplier_id', formulaTarget.id);
    const result = await upsertPricingRule(formData);
    setLoading(false);
    if (result.ok) {
      setFormulaTarget(null);
      setMessage(`Formula saved for ${formulaTarget.name}.`);
    } else {
      setError(result.error);
    }
  }

  async function toggleActive(supplier: Supplier) {
    setError(null);
    const result = supplier.active
      ? await deactivateSupplier(supplier.id)
      : await activateSupplier(supplier.id);
    if (result.ok) {
      setMessage(supplier.active ? `${supplier.name} deactivated.` : `${supplier.name} reactivated.`);
    } else {
      setError(result.error);
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setError(null);
    const result = await deleteSupplier(pendingDelete.id);
    setDeleting(false);
    if (result.ok) {
      setMessage(`${pendingDelete.name} deleted.`);
      setPendingDelete(null);
    } else {
      setError(result.error);
      setPendingDelete(null);
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Suppliers"
        description="Invite suppliers and assign each a pricing formula for sticker rates."
      >
        <Button onClick={() => { setShowInvite(true); setInviteSuccess(null); setError(null); }}>
          Invite Supplier
        </Button>
      </PageHeader>

      {message && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
          {message}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {inviteSuccess && (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-5">
          <p className="font-semibold text-amber-950">Supplier invited — share these details once</p>
          <p className="mt-2 text-sm text-amber-900">Temporary password:</p>
          <code className="mt-1 block rounded-md bg-white px-3 py-2 font-mono text-sm">{inviteSuccess.tempPassword}</code>
          <p className="mt-3 text-sm text-amber-900">
            <span className="font-medium">Assigned formula: </span>
            {inviteSuccess.formulaSummary}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => navigator.clipboard.writeText(inviteSuccess.tempPassword)}
          >
            Copy password
          </Button>
        </div>
      )}

      {suppliers.length === 0 ? (
        <EmptyState
          icon={<Users className="h-10 w-10" />}
          title="No suppliers yet"
          description="Invite your first supplier and set their pricing formula before they import Tally bills."
          actionLabel="Invite Supplier"
          onAction={() => setShowInvite(true)}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Supplier</th>
                <th className="px-4 py-3 text-left font-medium">Contact</th>
                <th className="px-4 py-3 text-left font-medium">Code</th>
                <th className="px-4 py-3 text-left font-medium">Formula</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id} className="border-t hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground">{s.email}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{s.phone || '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {formatSupplierCode(s.code_prefix, s.code_number) || '—'}
                  </td>
                  <td className="px-4 py-3">
                    {s.pricing_rule ? (
                      <p className="max-w-xs text-xs text-muted-foreground">
                        {describeFormula({
                          ma_markup1_pct: Number(s.pricing_rule.ma_markup1_pct) || 0,
                          ma_markup2_pct: Number(s.pricing_rule.ma_markup2_pct) || 0,
                          dna_markup1_pct: Number(s.pricing_rule.dna_markup1_pct) || 0,
                          dna_markup2_pct: Number(s.pricing_rule.dna_markup2_pct) || 0,
                          gst_pct: Number(s.pricing_rule.gst_pct) || 0,
                        })}
                      </p>
                    ) : (
                      <span className="text-muted-foreground">Not set</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={s.active ? 'default' : 'destructive'}>
                      {s.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" onClick={() => { setFormulaTarget(s); setError(null); }}>
                        Formula
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setEditing(s); setError(null); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Link
                        href={`/admin/suppliers/${s.id}`}
                        className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                      >
                        Dashboard
                      </Link>
                      <Link
                        href={`/admin/bills?supplier=${s.id}`}
                        className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-accent"
                      >
                        Bills
                      </Link>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleActive(s)}
                        title={s.active ? 'Deactivate' : 'Activate'}
                      >
                        {s.active ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => { setPendingDelete(s); setError(null); }}
                        title="Delete supplier"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pendingDelete && (
        <Modal title="Delete supplier?" onClose={() => setPendingDelete(null)}>
          <p className="text-sm text-muted-foreground">
            Delete <span className="font-medium text-foreground">{pendingDelete.name}</span>? This removes the
            supplier, their pricing formula, and their login access. This can&apos;t be undone.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            The supplier must have <span className="font-medium">zero bills</span> — export and clear the month,
            or delete the bills first.
          </p>
          <div className="mt-4 flex gap-2">
            <Button variant="destructive" disabled={deleting} onClick={handleDelete}>
              {deleting ? 'Deleting…' : 'Delete supplier'}
            </Button>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>Cancel</Button>
          </div>
        </Modal>
      )}

      {showInvite && (
        <Modal title="Invite Supplier" onClose={() => setShowInvite(false)}>
          <form action={handleInvite} className="space-y-4">
            <div>
              <Label htmlFor="invite-name">Name</Label>
              <Input id="invite-name" name="name" placeholder="Company name" required />
            </div>
            <div>
              <Label htmlFor="invite-email">Email</Label>
              <Input id="invite-email" name="email" type="email" placeholder="supplier@example.com" required />
            </div>
            <div>
              <Label htmlFor="invite-phone">Phone</Label>
              <Input id="invite-phone" name="phone" placeholder="Optional" />
            </div>
            <div>
              <Label htmlFor="invite-company-code">Company code</Label>
              <Input
                id="invite-company-code"
                name="code_prefix"
                placeholder="e.g. 000"
                maxLength={16}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                A short code you assign to this supplier to avoid confusion. Appears on labels next to the line-item HSN.
              </p>
            </div>
            <PricingRuleFields />
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={loading}>{loading ? 'Inviting…' : 'Send Invite'}</Button>
              <Button type="button" variant="outline" onClick={() => setShowInvite(false)}>Cancel</Button>
            </div>
          </form>
        </Modal>
      )}

      {editing && (
        <Modal title="Edit Supplier" onClose={() => setEditing(null)}>
          <form action={handleUpdate} className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Name</Label>
              <Input id="edit-name" name="name" defaultValue={editing.name} required />
            </div>
            <div>
              <Label htmlFor="edit-email">Email</Label>
              <Input id="edit-email" name="email" type="email" defaultValue={editing.email ?? ''} />
            </div>
            <div>
              <Label htmlFor="edit-phone">Phone</Label>
              <Input id="edit-phone" name="phone" defaultValue={editing.phone ?? ''} />
            </div>
            <div>
              <Label htmlFor="edit-company-code">Company code</Label>
              <Input
                id="edit-company-code"
                name="code_prefix"
                defaultValue={editing.code_prefix ?? ''}
                maxLength={16}
                placeholder="e.g. 000"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                A short code you assign to this supplier. Appears on labels next to the line-item HSN.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={loading}>Save</Button>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </form>
        </Modal>
      )}

      {formulaTarget && (
        <Modal title={`Formula — ${formulaTarget.name}`} onClose={() => setFormulaTarget(null)}>
          <form action={handleFormulaSave} className="space-y-4">
            <PricingRuleFields
              defaultValues={{
                ma_markup1_pct: Number(formulaTarget.pricing_rule?.ma_markup1_pct) || 0,
                ma_markup2_pct: Number(formulaTarget.pricing_rule?.ma_markup2_pct) || 0,
                dna_markup1_pct: Number(formulaTarget.pricing_rule?.dna_markup1_pct) || 0,
                dna_markup2_pct: Number(formulaTarget.pricing_rule?.dna_markup2_pct) || 0,
                gst_pct: Number(formulaTarget.pricing_rule?.gst_pct) || 5,
              }}
            />
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={loading}>Save Formula</Button>
              <Button type="button" variant="outline" onClick={() => setFormulaTarget(null)}>Cancel</Button>
            </div>
          </form>
        </Modal>
      )}
    </PageShell>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 text-slate-950 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>✕</Button>
        </div>
        {children}
      </div>
    </div>
  );
}
