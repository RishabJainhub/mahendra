import { FileInput, Printer, IndianRupee } from 'lucide-react';
import { LoginForm } from './login-form';
import { SetupBanner } from './setup-banner';
import { APP_LOGIN_SUBTITLE, APP_TAGLINE } from '@/lib/brand';
import { BrandLockup } from '@/components/brand/brand-lockup';
import { Logo } from '@/components/brand/logo';
import { isSupabaseConfigured } from '@/lib/env';

const FEATURES = [
  { icon: FileInput, label: 'Import Tally bills — PDF, XML, Excel' },
  { icon: Printer, label: 'Print barcode sticker sheets' },
  { icon: IndianRupee, label: 'Automatic MA/DNA pricing' },
];

export default function LoginPage() {
  const configured = isSupabaseConfigured();

  return (
    <div className="flex min-h-screen">
      {/* Left — brand heritage panel */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-sidebar p-12 text-white lg:flex">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_hsl(0_0%_100%/_0.04),_transparent_60%)]" />
        <div className="relative">
          <BrandLockup size="lg" inverted subtitle={APP_TAGLINE} />
        </div>

        <ul className="relative space-y-5">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <li key={f.label} className="flex items-start gap-4 text-sm text-sidebar-muted">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5">
                  <Icon className="h-4 w-4 text-white/90" />
                </span>
                <span className="pt-2 leading-snug">{f.label}</span>
              </li>
            );
          })}
        </ul>

        <p className="relative text-xs tracking-wide text-sidebar-muted uppercase">
          Trusted by distributors across India
        </p>
      </div>

      {/* Right — sign in */}
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-background p-6">
        {!configured && <SetupBanner />}
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center text-center lg:hidden">
            <Logo size="lg" />
            <p className="mt-4 font-display text-lg font-semibold tracking-tight">{APP_LOGIN_SUBTITLE}</p>
          </div>
          <p className="mb-6 hidden text-center text-sm text-muted-foreground lg:block">{APP_LOGIN_SUBTITLE}</p>
          <LoginForm disabled={!configured} />
        </div>
      </div>
    </div>
  );
}
