import type { MonthEndAlert } from '@/app/actions/dashboard';
import { ButtonLink } from '@/components/ui/button-link';
import { CalendarClock, Download } from 'lucide-react';

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
          <p className="flex items-center gap-1.5 font-medium text-foreground">
            <CalendarClock className="h-4 w-4" />
            {monthLabel}: {alert.billCount.toLocaleString('en-IN')} bills in the app
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {exported
              ? 'Excel export is on file. When the month is done, clear data under Settings to start fresh.'
              : `Export to Excel before month-end — ${alert.billCount.toLocaleString('en-IN')} bills should be archived before clearing.`}
          </p>
        </div>
        <ButtonLink
          href="/admin/settings"
          variant="outline"
          size="sm"
          className="shrink-0"
        >
          {exported ? (
            'Month-end settings'
          ) : (
            <>
              <Download className="mr-1.5 h-4 w-4" />
              Export now
            </>
          )}
        </ButtonLink>
      </div>
    </div>
  );
}
