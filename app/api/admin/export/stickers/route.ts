import { NextRequest, NextResponse } from 'next/server';
import { getBulkBillStickers } from '@/app/actions/bills';
import { createClient } from '@/lib/supabase/server';

function csvField(value: string | number): string {
  const s = String(value ?? '');
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function stickerLabel(prefix: string, value: number): string {
  // Match formatLabelPrice — strip trailing .00 if integer
  const formatted = Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
  return `${prefix}${formatted}B`;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const billIds = request.nextUrl.searchParams.getAll('billId');
  if (billIds.length === 0) {
    return new Response('Missing billId parameter', { status: 400 });
  }

  try {
    const bundles = await getBulkBillStickers(billIds);
    if (bundles.length === 0) {
      return new Response('No bills found', { status: 404 });
    }

    const header = ['Description', 'Code_HSN', 'MA_Label', 'DNA_Label', 'Qty'];
    const rows: string[] = [header.join(',')];

    for (const bundle of bundles) {
      const companyCode = bundle.bill.supplier_code;
      for (const item of bundle.items) {
        const itemHsn = item.hsn ?? '';
        const codeHsn = companyCode && itemHsn
          ? `${companyCode}(${itemHsn})`
          : companyCode || itemHsn;
        rows.push([
          csvField(item.description),
          csvField(codeHsn),
          csvField(stickerLabel('MA', item.ma_price)),
          csvField(stickerLabel('DNA', item.dna_price)),
          csvField(item.qty),
        ].join(','));
      }
    }

    const csv = rows.join('\n');
    const fileName = `stickers-${bundles.length}-bill${bundles.length > 1 ? 's' : ''}.csv`;

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return new Response(`Export failed: ${err instanceof Error ? err.message : 'unknown'}`, { status: 500 });
  }
}
