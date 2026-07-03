import { requireAdmin } from '@/lib/auth';
import { runAllHealthChecks } from '@/lib/health-check';
import { PageHeader, PageShell } from '@/components/layout/page-header';
import { ButtonLink } from '@/components/ui/button-link';
import { VerifyPanel } from './verify-panel';
import { ArrowLeft } from 'lucide-react';

export default async function AdminVerifyPage() {
  await requireAdmin();
  const initial = await runAllHealthChecks();

  return (
    <PageShell>
      <PageHeader
        title="System Verify"
        description="End-to-end checker for pricing formulas, imports, and barcodes."
      >
        <ButtonLink href="/admin" variant="outline">
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Dashboard
        </ButtonLink>
      </PageHeader>
      <VerifyPanel initial={initial} />
    </PageShell>
  );
}
