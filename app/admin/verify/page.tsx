import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { runAllHealthChecks } from '@/lib/health-check';
import { VerifyPanel } from './verify-panel';

export default async function AdminVerifyPage() {
  await requireAdmin();
  const initial = await runAllHealthChecks();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">System Verify</h1>
          <p className="text-sm text-muted-foreground">
            End-to-end checker for pricing formulas, imports, and barcodes.
          </p>
        </div>
        <Link
          href="/admin"
          className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-background px-3 text-sm hover:bg-accent"
        >
          ← Dashboard
        </Link>
      </div>
      <VerifyPanel initial={initial} />
    </div>
  );
}
