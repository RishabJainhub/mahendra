'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { signOut } from '@/app/actions/auth';

const NAV = [
  { href: '/supplier', label: 'Dashboard' },
  { href: '/supplier/import', label: 'Import' },
  { href: '/supplier/print', label: 'Print' },
  { href: '/supplier/history', label: 'History' },
];

type Props = {
  children: React.ReactNode;
  supplierName?: string;
  mustResetPassword?: boolean;
};

export function SupplierLayout({ children, supplierName, mustResetPassword }: Props) {
  const pathname = usePathname();
  const initials = supplierName
    ? supplierName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : 'SP';

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 border-r border-border bg-muted/30 p-4">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
            {initials}
          </div>
          <div className="text-sm font-medium">{supplierName ?? 'Supplier'}</div>
        </div>
        <nav className="space-y-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'block rounded-md px-3 py-2 text-sm hover:bg-accent',
                pathname === item.href || (item.href !== '/supplier' && pathname.startsWith(item.href))
                  ? 'bg-accent font-medium'
                  : 'text-muted-foreground'
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <form action={signOut} className="mt-8">
          <button type="submit" className="text-sm text-muted-foreground hover:text-foreground">
            Sign Out
          </button>
        </form>
      </aside>
      <div className="flex-1">
        {mustResetPassword && (
          <div className="bg-amber-100 px-6 py-2 text-sm text-amber-900">
            Please reset your password to continue using the portal.
          </div>
        )}
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
