'use client';

import { useActionState } from 'react';
import { signIn } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { APP_NAME } from '@/lib/brand';

export function LoginForm({ disabled = false }: { disabled?: boolean }) {
  const [state, formAction, pending] = useActionState(signIn, null);

  return (
    <Card className="w-full max-w-md border-0 shadow-lg lg:border lg:shadow-md">
      <CardHeader>
        <CardTitle className="text-2xl">{APP_NAME}</CardTitle>
        <CardDescription>Sign in to your account</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          {state && !state.ok && <p className="text-sm text-destructive">{state.error}</p>}
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium">
              Email
            </label>
            <Input id="email" name="email" type="email" required autoComplete="email" disabled={disabled || pending} />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium">
              Password
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              disabled={disabled || pending}
            />
          </div>
          <Button type="submit" className="w-full" disabled={disabled || pending}>
            {pending ? 'Signing in…' : 'Sign In'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
