'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { HealthCheckResult } from '@/lib/health-check';

export function VerifyPanel({
  initial,
}: {
  initial: {
    results: HealthCheckResult[];
    pass: number;
    fail: number;
    allPass: boolean;
  };
}) {
  const [state, setState] = useState(initial);
  const [loading, setLoading] = useState(false);

  async function rerun() {
    setLoading(true);
    const res = await fetch('/api/health/verify');
    const data = await res.json();
    setState(data);
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={state.allPass ? 'default' : 'destructive'}>
          {state.allPass ? 'ALL PASS' : `${state.fail} FAILED`}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {state.pass} passed · {state.fail} failed · {state.results.length} total checks
        </span>
        <Button onClick={rerun} disabled={loading} size="sm" variant="outline">
          {loading ? 'Running…' : 'Re-run checks'}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left">Category</th>
              <th className="px-3 py-2 text-left">Check</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Expected</th>
              <th className="px-3 py-2 text-left">Actual</th>
            </tr>
          </thead>
          <tbody>
            {state.results.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2 capitalize">{r.category}</td>
                <td className="px-3 py-2">{r.name}</td>
                <td className="px-3 py-2">
                  <Badge variant={r.pass ? 'default' : 'destructive'}>{r.pass ? 'PASS' : 'FAIL'}</Badge>
                </td>
                <td className="px-3 py-2 font-mono text-xs">{r.expected}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.actual}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Verifies Company 151 pricing math, INR formatting, Tally XML/PDF parsers, and real Code128 barcode PNG
        generation. Run <code className="rounded bg-muted px-1">npm run verify</code> in CI for the same checks.
      </p>
    </div>
  );
}
