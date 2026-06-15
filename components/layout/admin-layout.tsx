'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { signOut } from '@/app/actions/auth';

const NAV = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/bills', label: 'Bills' },
  { href: '/admin/suppliers', label: 'Suppliers' },
  { href: '/admin/items', label: 'Items' },
  { href: '/admin/imports', label: 'Imports' },
  { href: '/admin/pricing', label: 'Pricing' },
  { href: '/admin/layouts', label: 'Layouts' },
  { href: '/admin/print', label: 'Print' },
  { href: '/admin/settings', label: 'Settings' },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 border-r border-border bg-muted/30 p-4">
        <div className="mb-6 font-semibold">Mahendra Admin</div>
        <nav className="space-y-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'block rounded-md px-3 py-2 text-sm hover:bg-accent',
                pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
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
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
