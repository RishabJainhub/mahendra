import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { APP_LOGIN_SUBTITLE } from '@/lib/brand';
import { Logo } from '@/components/brand/logo';
import { ResetPasswordForm } from './reset-form';

export default async function ResetPasswordPage() {
  const user = await requireUser();

  if (!user.must_reset_password) {
    redirect(user.role === 'admin' ? '/admin' : '/supplier');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size="lg" />
          <p className="mt-4 font-display text-sm font-medium text-muted-foreground">{APP_LOGIN_SUBTITLE}</p>
        </div>
        <ResetPasswordForm />
      </div>
    </div>
  );
}
