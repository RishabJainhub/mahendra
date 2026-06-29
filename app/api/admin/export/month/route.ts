import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildMonthExportBuffer, recordMonthExport } from '@/app/actions/month-end';
import { monthBounds } from '@/lib/export/monthly-bills';

// Month-end export can scan thousands of bills + line items; allow up to 60s
// on Vercel so large tenants don't time out before the buffer streams.
export const maxDuration = 60;

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const month = new URL(request.url).searchParams.get('month') ?? '';
  if (!monthBounds(month)) {
    return new Response('Invalid month — use YYYY-MM', { status: 400 });
  }

  try {
    const result = await buildMonthExportBuffer(month);
    if (!result) {
      return new Response(`No bills found for ${month}`, { status: 404 });
    }

    await recordMonthExport(month);

    return new Response(new Uint8Array(result.buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${result.fileName}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return new Response('Export failed', { status: 500 });
  }
}
