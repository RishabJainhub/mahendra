import { getBills } from '@/app/actions/bills';
import { getDefaultLayout } from '@/app/actions/supplier';
import { requireSupplier } from '@/lib/auth';
import { PrintPageClient } from './print-client';
import { PageHeader, PageShell } from '@/components/layout/page-header';

type Props = {
  searchParams: Promise<{ billId?: string }>;
};

export default async function SupplierPrintPage({ searchParams }: Props) {
  await requireSupplier();
  const { billId } = await searchParams;
  const { bills } = await getBills({ pageSize: 100 });
  const printable = (bills as { id: string; bill_number: string; bill_date: string; status: string }[])
    .filter((b) => b.status === 'imported' || b.status === 'printed');
  const layout = await getDefaultLayout();

  return (
    <PageShell>
      <PageHeader
        title="Print Barcodes"
        description="Generate sticker sheets with barcodes. Preview first, then mark as printed."
      />
      <PrintPageClient bills={printable} layout={layout} initialBillId={billId} />
    </PageShell>
  );
}
