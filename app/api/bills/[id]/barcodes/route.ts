import { NextRequest, NextResponse } from 'next/server';
import { generateBarcodePng } from '@/lib/barcode';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await params;

  // Authenticated-only: middleware treats /api/* as public, so guard here.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(_request.url);

  const data = searchParams.get('data');
  if (!data) {
    return NextResponse.json({ error: 'data query param required' }, { status: 400 });
  }

  const type = searchParams.get('type') ?? 'code128';
  const scale = Number(searchParams.get('scale') ?? 2);
  const height = Number(searchParams.get('height') ?? 10);

  try {
    const png = await generateBarcodePng({ data, type, scale, height });
    return new NextResponse(new Uint8Array(png), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (err) {
    return NextResponse.json({ error: 'Barcode generation failed' }, { status: 500 });
  }
}
