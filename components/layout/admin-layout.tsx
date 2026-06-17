'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileInput,
  Printer,
  History,
  Receipt,
  Users,
  Package,
  IndianRupee,
  LayoutGrid,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { signOut } from '@/app/actions/auth';
import { APP_NAME } from '@/lib/brand';

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/bills', label: 'Bills', icon: Receipt },
  { href: '/admin/suppliers', label: 'Suppliers', icon: Users },
  { href: '/admin/items', label: 'Items', icon: Package },
  { href: '/admin/imports', label: 'Imports', icon: FileInput },
  { href: '/admin/pricing', label: 'Pricing', icon: IndianRupee },
  { href: '/admin/layouts', label: 'Layouts', icon: LayoutGrid },
  { href: '/admin/print', label: 'Print', icon: Printer },
  { href: '/admin/verify', label: 'Verify', icon: ShieldCheck },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 flex-col bg-sidebar text-sidebar-foreground">
        <div className="border-b border-white/10 px-5 py-5">
          <div className="text-lg font-bold tracking-tight text-white">{APP_NAME}</div>
          <div className="text-xs text-sidebar-muted">Admin</div>
        </div>
        <nav className="flex-1 space-y-0.5 p-3">
          {NAV.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== '/admin' && pathname.startsWith(item.href));
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
      <main className="flex-1 bg-background p-6">{children}</main>
    </div>
  );
}
