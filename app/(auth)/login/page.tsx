import { LoginForm } from './login-form';
import { APP_NAME, APP_TAGLINE } from '@/lib/brand';

export default function LoginPage() {
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
      <div className="flex flex-1 items-center justify-center p-6">
        <LoginForm />
      </div>
    </div>
  );
}
