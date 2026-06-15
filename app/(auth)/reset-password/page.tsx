import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { ResetPasswordForm } from './reset-form';

export default async function ResetPasswordPage() {
  const user = await requireUser();

  if (!user.must_reset_password) {
    redirect(user.role === 'admin' ? '/admin' : '/supplier');
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <ResetPasswordForm />
    </div>
  );
}
