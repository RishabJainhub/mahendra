'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileInput, Printer, Search } from 'lucide-react';
import { QuickPrintToday } from '@/app/admin/quick-print-today';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type Props = {
  unprintedCount?: number;
};

function ActionCard({
  href,
  onClick,
  icon: Icon,
  title,
  description,
  badge,
  className,
  children,
}: {
  href?: string;
  onClick?: () => void;
  icon: typeof FileInput;
  title: string;
  description: string;
  badge?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-6 w-6" />
        </span>
        {badge && (
          <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">
            {badge}
          </span>
        )}
      </div>
      <div className="mt-4">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </>
  );

  const cardClass = cn(
    'flex min-h-[168px] flex-col rounded-2xl border bg-card p-6 shadow-sm transition-colors hover:border-primary/30 hover:bg-primary/[0.02]',
    className
  );

  if (href) {
    return (
      <Link href={href} className={cardClass}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={cn(cardClass, 'text-left')}>
      {inner}
    </button>
  );
}

export function DashboardActions({ unprintedCount = 0 }: Props) {
  const router = useRouter();
  const [billQuery, setBillQuery] = useState('');

  function handleFindBill(e: React.FormEvent) {
    e.preventDefault();
    const q = billQuery.trim();
    if (!q) {
      router.push('/admin/bills');
      return;
    }
    router.push(`/admin/bills?q=${encodeURIComponent(q)}`);
  }

  return (
    <section className="mb-8">
      <p className="mb-4 text-sm text-muted-foreground">
        Pick what you need — upload a bill, print today&apos;s stickers, or find an old bill.
      </p>
      <div className="grid gap-4 md:grid-cols-3">
        <ActionCard
          href="/admin/imports"
          icon={FileInput}
          title="Upload bill"
          description="Drop a supplier Tally PDF, Excel, or CSV to import."
        />

        <div className="flex min-h-[168px] flex-col rounded-2xl border bg-card p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Printer className="h-6 w-6" />
            </span>
            {unprintedCount > 0 && (
              <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">
                {unprintedCount} waiting
              </span>
            )}
          </div>
          <div className="mt-4 flex flex-1 flex-col">
            <h2 className="text-lg font-semibold tracking-tight">Print today&apos;s stickers</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              All unprinted bills dated today — one click to print.
            </p>
            <div className="mt-4">
              <QuickPrintToday variant="card" />
            </div>
          </div>
        </div>

        <form onSubmit={handleFindBill} className="flex min-h-[168px] flex-col rounded-2xl border bg-card p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Search className="h-6 w-6" />
            </span>
          </div>
          <div className="mt-4 flex flex-1 flex-col">
            <h2 className="text-lg font-semibold tracking-tight">Find a bill</h2>
            <p className="mt-1 text-sm text-muted-foreground">Search by bill number across all suppliers.</p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Input
                value={billQuery}
                onChange={(e) => setBillQuery(e.target.value)}
                placeholder="e.g. INV-1042"
                className="flex-1"
                aria-label="Bill number"
              />
              <Button type="submit" className="shrink-0">
                Search
              </Button>
            </div>
          </div>
        </form>
      </div>
    </section>
  );
}
