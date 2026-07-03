'use client';

import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { resetPassword } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/field';

export function ResetPasswordForm() {
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);
    const result = await resetPassword(formData);
    if (result && !result.ok) {
      setError(result.error);
    }
  }

  return (
    <Card className="w-full max-w-md border-border/80 shadow-elevated">
      <CardHeader>
        <CardTitle className="font-display text-xl font-semibold tracking-tight">Reset your password</CardTitle>
        <CardDescription>Choose a new password before continuing.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-l-4 border-l-destructive bg-destructive/5 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <div>
            <Label htmlFor="newPassword">New Password</Label>
            <Input id="newPassword" name="newPassword" type="password" required minLength={8} autoComplete="new-password" />
          </div>
          <div>
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input id="confirmPassword" name="confirmPassword" type="password" required minLength={8} autoComplete="new-password" />
          </div>
          <Button type="submit" className="w-full">Update Password</Button>
        </form>
      </CardContent>
    </Card>
  );
}
