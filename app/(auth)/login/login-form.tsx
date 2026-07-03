'use client';

import { useActionState } from 'react';
import { AlertCircle } from 'lucide-react';
import { signIn } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/field';

export function LoginForm({ disabled = false }: { disabled?: boolean }) {
  const [state, formAction, pending] = useActionState(signIn, null);

  return (
    <Card className="w-full max-w-md border-border/80 shadow-elevated lg:border lg:shadow-card">
      <CardHeader className="pb-4">
        <CardTitle className="font-display text-2xl font-semibold tracking-tight">Sign in</CardTitle>
        <CardDescription>Enter your credentials to access the portal.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          {state && !state.ok && (
            <div className="flex items-start gap-2 rounded-md border border-l-4 border-l-destructive bg-destructive/5 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{state.error}</span>
            </div>
          )}
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" disabled={disabled || pending} />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              disabled={disabled || pending}
            />
          </div>
          <Button type="submit" className="w-full font-medium" disabled={disabled || pending}>
            {pending ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
