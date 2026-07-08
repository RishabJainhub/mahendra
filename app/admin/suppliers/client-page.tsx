'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Pencil, UserX, UserCheck, Trash2, Send, KeyRound, Receipt, Calculator } from 'lucide-react';
import {
  createSupplier,
  sendSupplierInvite,
  regenerateSupplierPassword,
  updateSupplier,
  deactivateSupplier,
  activateSupplier,
  deleteSupplier,
  upsertPricingRule,
} from '@/app/actions/suppliers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button-link';
import { ActionMenu } from '@/components/ui/action-menu';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
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
  has_login?: boolean;
};

type InviteSuccess = {
  supplierName: string;
  tempPassword: string;
  formulaSummary: string;
};

export function SuppliersClient({ suppliers }: { suppliers: Supplier[] }) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [formulaTarget, setFormulaTarget] = useState<Supplier | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<InviteSuccess | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [emailPrompt, setEmailPrompt] = useState<Supplier | null>(null);
  const [promptEmail, setPromptEmail] = useState('');
  const [prompting, setPrompting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Supplier | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleAdd(formData: FormData) {
    setLoading(true);
    setError(null);
    const result = await createSupplier(formData);
    setLoading(false);
    if (result.ok) {
      setShowAdd(false);
      setInviteSuccess(null);
      setMessage('Supplier added. Click "Invite" on their row to send a login.');
    } else {
      setError(result.error);
    }
  }

  /**
   * Per-row Invite. If the supplier already has an email, send the invite
   * immediately. Otherwise open a small prompt to capture an email first.
   */
  async function handleInviteClick(supplier: Supplier) {
    if (supplier.email && supplier.email.trim()) {
      await runInvite(supplier, supplier.email.trim());
    } else {
      setPromptEmail('');
      setEmailPrompt(supplier);
      setError(null);
    }
  }

  async function runInvite(supplier: Supplier, email: string) {
    setInvitingId(supplier.id);
    setError(null);
    setInviteSuccess(null);
    const result = await sendSupplierInvite(supplier.id, email);
    setInvitingId(null);
    if (result.ok) {
      setInviteSuccess({
        supplierName: supplier.name,
        tempPassword: result.data.tempPassword,
        formulaSummary: result.data.formulaSummary,
      });
      setEmailPrompt(null);
      setMessage(`Invite sent to ${supplier.name}.`);
    } else {
      setError(result.error);
    }
  }

  async function submitEmailPrompt(e: React.FormEvent) {
    e.preventDefault();
    if (!emailPrompt) return;
    const email = promptEmail.trim();
    if (!email) {
      setError('Enter an email address.');
      return;
    }
    setPrompting(true);
    await runInvite(emailPrompt, email);
    setPrompting(false);
  }

  async function handleNewPassword(supplier: Supplier) {
    setResettingId(supplier.id);
    setError(null);
    setInviteSuccess(null);
    const result = await regenerateSupplierPassword(supplier.id);
    setResettingId(null);
    if (result.ok) {
      setInviteSuccess({
        supplierName: supplier.name,
        tempPassword: result.data.tempPassword,
        formulaSummary: 'New temporary password generated. The old one no longer works.',
      });
      setMessage(`New password generated for ${supplier.name}.`);
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
        description="Add a supplier, then click Invite on their row to send a login. Suppliers that already have a login show New password instead."
      >
        <Button onClick={() => { setShowAdd(true); setInviteSuccess(null); setError(null); }}>
          Add Supplier
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
          <p className="font-semibold text-amber-950">
            {inviteSuccess.supplierName} invited — share these details once
          </p>
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
          description="Add your first supplier and set their pricing formula. Click Invite on their row to send a login."
          actionLabel="Add Supplier"
          onAction={() => setShowAdd(true)}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <Table>
            <THead>
              <TR>
                <TH>Supplier</TH>
                <TH>Contact</TH>
                <TH>Code</TH>
                <TH>Formula</TH>
                <TH>Status</TH>
                <TH align="right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {suppliers.map((s) => (
                <TR key={s.id}>
                  <TD>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground">{s.email}</div>
                  </TD>
                  <TD className="text-muted-foreground">{s.phone || '—'}</TD>
                  <TD className="font-mono text-xs">
                    {formatSupplierCode(s.code_prefix, s.code_number) || '—'}
                  </TD>
                  <TD>
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
                  </TD>
                  <TD>
                    <Badge variant={s.active ? 'default' : 'destructive'}>
                      {s.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TD>
                  <TD>
                    <div className="flex items-center justify-end gap-1.5">
                      {!s.has_login ? (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => void handleInviteClick(s)}
                          disabled={invitingId === s.id}
                          title={s.email ? 'Create a login and generate a temp password' : 'Add an email, then create a login'}
                        >
                          <Send className="mr-1 h-3.5 w-3.5" />
                          {invitingId === s.id ? 'Inviting…' : 'Invite'}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void handleNewPassword(s)}
                          disabled={resettingId === s.id}
                          title="Generate a new temporary password (the old one stops working)"
                        >
                          <KeyRound className="mr-1 h-3.5 w-3.5" />
                          {resettingId === s.id ? 'Resetting…' : 'New password'}
                        </Button>
                      )}
                      <ButtonLink href={`/admin/suppliers/${s.id}`} variant="outline" size="sm">
                        Dashboard
                      </ButtonLink>
                      <ActionMenu
                        label={`More actions for ${s.name}`}
                        items={[
                          {
                            label: 'Pricing formula',
                            icon: <Calculator className="h-4 w-4" />,
                            onSelect: () => { setFormulaTarget(s); setError(null); },
                          },
                          {
                            label: 'Edit details',
                            icon: <Pencil className="h-4 w-4" />,
                            onSelect: () => { setEditing(s); setError(null); },
                          },
                          {
                            label: 'View bills',
                            icon: <Receipt className="h-4 w-4" />,
                            onSelect: () => router.push(`/admin/bills?supplier=${s.id}`),
                          },
                          {
                            label: s.active ? 'Deactivate' : 'Activate',
                            icon: s.active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />,
                            onSelect: () => void toggleActive(s),
                          },
                          {
                            label: 'Delete supplier',
                            icon: <Trash2 className="h-4 w-4" />,
                            onSelect: () => { setPendingDelete(s); setError(null); },
                            destructive: true,
                          },
                        ]}
                      />
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
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

      {showAdd && (
        <Modal title="Add Supplier" onClose={() => setShowAdd(false)}>
          <form action={handleAdd} className="space-y-4">
            <div>
              <Label htmlFor="add-name">Name</Label>
              <Input id="add-name" name="name" placeholder="Company name" required />
            </div>
            <div>
              <Label htmlFor="add-email">Email</Label>
              <Input id="add-email" name="email" type="email" placeholder="supplier@example.com (optional)" />
              <p className="mt-1 text-xs text-muted-foreground">
                Optional now. Required later only when you click “Send invite” to create their login.
              </p>
            </div>
            <div>
              <Label htmlFor="add-phone">Phone</Label>
              <Input id="add-phone" name="phone" placeholder="Optional" />
            </div>
            <div>
              <Label htmlFor="add-company-code">Company code</Label>
              <Input
                id="add-company-code"
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
              <Button type="submit" disabled={loading}>{loading ? 'Adding…' : 'Add supplier'}</Button>
              <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            </div>
          </form>
        </Modal>
      )}

      {emailPrompt && (
        <Modal title={`Invite — ${emailPrompt.name}`} onClose={() => setEmailPrompt(null)}>
          <form onSubmit={submitEmailPrompt} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This supplier has no email yet. Enter one to create their login and generate a temporary password.
            </p>
            <div>
              <Label htmlFor="prompt-email">Email</Label>
              <Input
                id="prompt-email"
                type="email"
                placeholder="supplier@example.com"
                value={promptEmail}
                onChange={(e) => setPromptEmail(e.target.value)}
                autoFocus
                required
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={prompting}>
                {prompting ? 'Inviting…' : 'Send invite'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setEmailPrompt(null)}>Cancel</Button>
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
