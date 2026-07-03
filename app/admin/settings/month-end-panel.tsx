'use client';

import { useCallback, useEffect, useState } from 'react';
import { closeMonth, getMonthEndSummary, type MonthEndSummary } from '@/app/actions/month-end';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/field';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { formatINR } from '@/lib/pricing';
import { CalendarDays, Download, Trash2 } from 'lucide-react';

function currentMonthValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function MonthEndPanel() {
  const [month, setMonth] = useState(currentMonthValue);
  const [summary, setSummary] = useState<MonthEndSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [closing, setClosing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true);
    setError(null);
    try {
      const result = await getMonthEndSummary(month);
      if (result.ok) {
        setSummary(result.data);
      } else {
        setSummary(null);
        setError(result.error);
      }
    } catch {
      setSummary(null);
      setError('Could not load month summary. Refresh the page.');
    } finally {
      setLoadingSummary(false);
    }
  }, [month]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  async function handleCloseMonth() {
    setClosing(true);
    setError(null);
    setMessage(null);
    const result = await closeMonth(month, confirmText);
    if (result.ok) {
      setMessage(
        `Removed ${result.data.deletedBills} bills for ${month}. Suppliers, pricing, and items are unchanged.`
      );
      setConfirmText('');
      await loadSummary();
    } else {
      setError(result.error);
    }
    setClosing(false);
  }

  const confirmPhrase = `CLOSE ${month}`;
  const canClear =
    summary &&
    summary.billCount > 0 &&
    summary.exported &&
    confirmText === confirmPhrase &&
    !closing;

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          Month-end export &amp; reset
        </CardTitle>
        <CardDescription>
          Download all bills for a month to Excel, then clear that month from the app so you start fresh.
          Suppliers, pricing rules, item catalog, and layouts are kept.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="month" className="text-xs font-medium text-muted-foreground">Month</Label>
            <Input
              id="month"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-44"
            />
          </div>
          <Button type="button" variant="outline" onClick={() => void loadSummary()} disabled={loadingSummary}>
            {loadingSummary ? 'Refreshing…' : 'Refresh counts'}
          </Button>
        </div>

        {summary && (
          <div className="grid gap-2 rounded-md bg-muted/40 p-4 text-sm sm:grid-cols-3">
            <div>
              <div className="text-xs text-muted-foreground">Bills</div>
              <div className="text-lg font-semibold">{summary.billCount.toLocaleString('en-IN')}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Line items</div>
              <div className="text-lg font-semibold">{summary.lineItemCount.toLocaleString('en-IN')}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Total value</div>
              <div className="text-lg font-semibold">{formatINR(summary.totalInr)}</div>
            </div>
          </div>
        )}

        {summary && summary.billCount > 0 && (
          <div
            className={`rounded-md border p-3 text-sm ${
              summary.exported
                ? 'border-green-200 bg-green-50 text-green-900'
                : 'border-amber-200 bg-amber-50 text-amber-950'
            }`}
          >
            {summary.exported ? (
              <>
                Excel export recorded
                {summary.exportedAt
                  ? ` on ${new Date(summary.exportedAt).toLocaleString('en-IN')}`
                  : ''}
                . You may clear this month after verifying your file.
              </>
            ) : (
              <>Download Excel below before clearing — export is required to protect your records.</>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          {summary && summary.billCount > 0 ? (
            <a
              href={`/api/admin/export/month?month=${encodeURIComponent(month)}`}
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Download className="mr-1.5 h-4 w-4" />
              Download Excel
            </a>
          ) : (
            <Button type="button" disabled>
              <Download className="mr-1.5 h-4 w-4" />
              Download Excel
            </Button>
          )}
        </div>

        <div className="space-y-3 border-t pt-4">
          <p className="flex items-center gap-1.5 text-sm font-medium text-destructive">
            <Trash2 className="h-4 w-4" />
            Clear month from app
          </p>
          <p className="text-sm text-muted-foreground">
            Export first and keep the file safe. This permanently deletes all bills (and their line
            items) dated in {month}. Type <span className="font-mono">{confirmPhrase}</span> to confirm.
          </p>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={confirmPhrase}
            className="max-w-sm font-mono"
          />
          <Button
            type="button"
            variant="destructive"
            disabled={!canClear}
            onClick={() => void handleCloseMonth()}
          >
            {closing ? 'Clearing…' : 'Clear month & start fresh'}
          </Button>
          {summary && summary.billCount > 0 && !summary.exported && (
            <p className="text-sm text-amber-800">Clear is blocked until Excel is downloaded.</p>
          )}
        </div>

        {message && <p className="text-sm text-green-700">{message}</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
