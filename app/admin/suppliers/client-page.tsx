'use client';

import { useState } from 'react';
import { inviteSupplier } from '@/app/actions/suppliers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

type Supplier = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  active: boolean;
  pricing_rule?: { model: string } | null;
};

export function SuppliersClient({ suppliers }: { suppliers: Supplier[] }) {
  const [showModal, setShowModal] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleInvite(formData: FormData) {
    setError(null);
    const result = await inviteSupplier(formData);
    if (result.ok) {
      setTempPassword(result.data.tempPassword);
      setShowModal(false);
    } else {
      setError(result.error);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Suppliers</h1>
        <Button onClick={() => { setShowModal(true); setTempPassword(null); }}>Invite Supplier</Button>
      </div>

      {tempPassword && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p className="font-medium">Supplier invited! One-time temporary password:</p>
          <code className="mt-2 block rounded bg-white px-3 py-2 font-mono">{tempPassword}</code>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => navigator.clipboard.writeText(tempPassword)}
          >
            Copy
          </Button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Phone</th>
              <th className="px-4 py-3 text-left">Pricing</th>
              <th className="px-4 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="px-4 py-3">{s.name}</td>
                <td className="px-4 py-3">{s.email}</td>
                <td className="px-4 py-3">{s.phone}</td>
                <td className="px-4 py-3">{s.pricing_rule?.model ?? '—'}</td>
                <td className="px-4 py-3">
                  <Badge variant={s.active ? 'default' : 'destructive'}>
                    {s.active ? 'Active' : 'Inactive'}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold">Invite Supplier</h2>
            {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
            <form action={handleInvite} className="space-y-3">
              <Input name="name" placeholder="Name" required />
              <Input name="email" type="email" placeholder="Email" required />
              <Input name="phone" placeholder="Phone" />
              <div className="flex gap-2">
                <Button type="submit">Invite</Button>
                <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
