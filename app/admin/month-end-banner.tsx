import Link from 'next/link';
import type { MonthEndAlert } from '@/app/actions/dashboard';

type Props = {
  alert: MonthEndAlert;
};

function formatMonthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

export function MonthEndBanner({ alert }: Props) {
  if (alert.billCount === 0) return null;

  const monthLabel = formatMonthLabel(alert.month);
  const exported = alert.exported;

  return (
    <div
      className={`mb-6 rounded-lg border p-4 ${
        exported
          ? 'border-blue-200 bg-blue-50'
          : 'border-amber-300 bg-amber-50'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-foreground">
            {monthLabel}: {alert.billCount.toLocaleString('en-IN')} bills in the app
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {exported
              ? 'Excel export is on file. When the month is done, clear data under Settings to start fresh.'
              : `Export to Excel before month-end — ${alert.billCount.toLocaleString('en-IN')} bills should be archived before clearing.`}
          </p>
        </div>
        <Link
          href="/admin/settings"
          className="inline-flex h-9 shrink-0 items-center rounded-md border bg-background px-3 text-sm font-medium hover:bg-accent"
        >
          {exported ? 'Month-end settings' : 'Export now'}
        </Link>
      </div>
    </div>
  );
}
