import { NextRequest, NextResponse } from 'next/server';
import { getBulkBillStickers } from '@/app/actions/bills';
import { createClient } from '@/lib/supabase/server';
import { buildStickerLines } from '@/lib/pdf/sticker-lines';

function csvField(value: string | number): string {
  const s = String(value ?? '');
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
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
      for (const item of bundle.items) {
        const lines = buildStickerLines(item, bundle.bill.supplier_code, 'roll');
        rows.push([
          csvField(lines.line1.text),
          csvField(lines.line2),
          csvField(lines.line3),
          csvField(lines.line4),
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
