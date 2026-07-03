import * as React from 'react';
import Link, { type LinkProps } from 'next/link';
import { type VariantProps } from 'class-variance-authority';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type ButtonLinkProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> &
  VariantProps<typeof buttonVariants> &
  Omit<LinkProps, 'href'> & {
    href: string;
    className?: string;
    children?: React.ReactNode;
  };

export function ButtonLink({
  href,
  variant,
  size,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      className={cn(buttonVariants({ variant, size }), className)}
      {...rest}
    >
      {children}
    </Link>
  );
}
