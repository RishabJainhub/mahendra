import { KeyRound, Phone } from 'lucide-react';
import { getSupportPhone, getSupportPhoneTel } from '@/lib/support';

export function SupplierPasswordHelp() {
  const phone = getSupportPhone();
  const tel = getSupportPhoneTel();

  return (
    <div className="mt-4 rounded-lg border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
      <div className="flex items-start gap-2">
        <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-amber-800" />
        <div>
          <p className="font-medium">Supplier forgot password?</p>
          <p className="mt-1 text-amber-900/90">
            This app does not reset passwords by email. Ask your Mahindra admin to open{' '}
            <span className="font-medium">Suppliers → New password</span> and share the new temporary
            password with you.
          </p>
          {phone && tel ? (
            <a
              href={`tel:${tel}`}
              className="mt-2 inline-flex items-center gap-1.5 font-medium text-amber-950 underline-offset-2 hover:underline"
            >
              <Phone className="h-3.5 w-3.5" />
              Call Mahindra: {phone}
            </a>
          ) : (
            <p className="mt-2 text-amber-900/90">Contact your Mahindra admin for a new password.</p>
          )}
        </div>
      </div>
    </div>
  );
}
