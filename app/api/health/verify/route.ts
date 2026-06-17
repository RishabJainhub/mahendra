import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runAllHealthChecks } from '@/lib/health-check';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const result = await runAllHealthChecks();
  return NextResponse.json(result);
}
