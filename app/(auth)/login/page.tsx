import { LoginForm } from './login-form';
import { SetupBanner } from './setup-banner';
import { APP_NAME, APP_TAGLINE } from '@/lib/brand';
import { isSupabaseConfigured } from '@/lib/env';

export default function LoginPage() {
  const configured = isSupabaseConfigured();

  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 flex-col justify-between bg-sidebar p-12 text-white lg:flex">
        <div>
          <div className="text-2xl font-bold tracking-tight">{APP_NAME}</div>
          <p className="mt-2 text-sidebar-muted">{APP_TAGLINE}</p>
        </div>
        <div className="space-y-4 text-sm text-sidebar-muted">
          <p>Import Tally bills, apply pricing rules, and print barcode sticker sheets — all in one place.</p>
          <p>Supports PDF, XML, and Excel exports from TallyPrime.</p>
        </div>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
        {!configured && <SetupBanner />}
        <LoginForm disabled={!configured} />
      </div>
    </div>
  );
}
