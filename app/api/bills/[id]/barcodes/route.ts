import { NextRequest, NextResponse } from 'next/server';
import { generateBarcodePng } from '@/lib/barcode';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await params;
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
