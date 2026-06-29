'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, FileInput, Printer, History } from 'lucide-react';
import { cn } from '@/lib/utils';
import { signOut } from '@/app/actions/auth';
import { APP_NAME } from '@/lib/brand';

const NAV = [
  { href: '/supplier', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/supplier/import', label: 'Import', icon: FileInput },
  { href: '/supplier/print', label: 'Print', icon: Printer },
  { href: '/supplier/history', label: 'History', icon: History },
];

type Props = {
  children: React.ReactNode;
  supplierName?: string;
  mustResetPassword?: boolean;
};

export function SupplierLayout({ children, supplierName, mustResetPassword }: Props) {
  const pathname = usePathname();
  const initials = supplierName
    ? supplierName
        .split(' ')
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'SP';

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 flex-col bg-sidebar text-sidebar-foreground">
        <div className="border-b border-white/10 px-5 py-5">
          <div className="text-lg font-bold tracking-tight text-white">{APP_NAME}</div>
          <div className="mt-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold text-white">
              {initials}
            </div>
            <div className="text-sm font-medium text-sidebar-foreground">{supplierName ?? 'Supplier'}</div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 p-3">
          {NAV.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== '/supplier' && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors',
                  active
                    ? 'bg-sidebar-accent font-medium text-white'
                    : 'text-sidebar-muted hover:bg-white/5 hover:text-sidebar-foreground'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <form action={signOut} className="border-t border-white/10 p-4">
          <button
            type="submit"
            className="w-full rounded-md px-3 py-2 text-left text-sm text-sidebar-muted hover:bg-white/5 hover:text-sidebar-foreground"
          >
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
        <main className="bg-background p-6">{children}</main>
      </div>
    </div>
  );
}
