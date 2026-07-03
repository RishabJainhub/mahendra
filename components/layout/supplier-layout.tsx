'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { LayoutDashboard, FileInput, Printer, Receipt, Menu, X, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { signOut } from '@/app/actions/auth';
import { BrandLockup } from '@/components/brand/brand-lockup';
import { Logo } from '@/components/brand/logo';

const NAV = [
  { href: '/supplier', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/supplier/import', label: 'Import', icon: FileInput },
  { href: '/supplier/print', label: 'Print', icon: Printer },
  { href: '/supplier/bills', label: 'Bills', icon: Receipt },
];

type Props = {
  children: React.ReactNode;
  supplierName?: string;
  mustResetPassword?: boolean;
};

export function SupplierLayout({ children, supplierName, mustResetPassword }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const initials = supplierName
    ? supplierName
        .split(' ')
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'SP';

  const sidebarContent = (
    <>
      <div className="border-b border-sidebar-border px-5 py-5">
        <BrandLockup size="sm" inverted subtitle="Supplier portal" />
        <div className="mt-4 flex items-center gap-2.5 rounded-md border border-white/10 bg-white/5 px-3 py-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/15 text-[10px] font-semibold text-white">
            {initials}
          </div>
          <div className="min-w-0 truncate text-sm font-medium text-sidebar-foreground">
            {supplierName ?? 'Supplier'}
          </div>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {NAV.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== '/supplier' && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                'flex items-center gap-3 rounded-md border-l-2 px-3 py-2.5 text-sm transition-colors',
                active
                  ? 'border-l-white bg-sidebar-accent font-medium text-white'
                  : 'border-l-transparent text-sidebar-muted hover:bg-white/5 hover:text-sidebar-foreground'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <form action={signOut} className="border-t border-sidebar-border p-4">
        <button
          type="submit"
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-sidebar-muted hover:bg-white/5 hover:text-sidebar-foreground"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </form>
    </>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        {sidebarContent}
      </aside>

      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-sidebar-border bg-sidebar px-4 text-white lg:hidden">
        <div className="flex min-w-0 items-center gap-2.5">
          <Logo size="xs" inverted className="shrink-0" />
          <span className="truncate font-display text-sm font-semibold">{supplierName ?? 'Supplier'}</span>
        </div>
        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setOpen(true)}
          className="rounded-md p-2 text-sidebar-muted hover:bg-white/5 hover:text-sidebar-foreground"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-black/60 lg:hidden"
              onClick={() => setOpen(false)}
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.22, ease: 'easeOut' }}
              className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar text-sidebar-foreground lg:hidden"
            >
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="absolute right-3 top-3 rounded-md p-2 text-sidebar-muted hover:bg-white/5 hover:text-sidebar-foreground"
              >
                <X className="h-5 w-5" />
              </button>
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 pt-14 lg:pt-0">
        {mustResetPassword && (
          <div className="border-b border-amber-200 bg-amber-50 px-6 py-2.5 text-sm text-amber-950">
            Please reset your password to continue using the portal.
          </div>
        )}
        <main className="bg-background p-6">{children}</main>
      </div>
    </div>
  );
}
