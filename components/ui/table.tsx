import * as React from 'react';
import { cn } from '@/lib/utils';

type Align = 'left' | 'right' | 'center';

const alignClass: Record<Align, string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
};

export function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return <table className={cn('w-full text-sm', className)} {...props} />;
}

export function THead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn('border-y bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground', className)}
      {...props}
    />
  );
}

export function TBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn(className)} {...props} />;
}

export function TFoot({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tfoot className={cn('border-t-2 bg-muted/30', className)} {...props} />;
}

export function TR({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('border-b last:border-0 hover:bg-muted/20', className)} {...props} />;
}

export interface THProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  align?: Align;
}

export function TH({ className, align = 'left', ...props }: THProps) {
  return (
    <th
      className={cn('px-3 py-2.5 font-medium', alignClass[align], className)}
      {...props}
    />
  );
}

export interface TDProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  align?: Align;
}

export function TD({ className, align = 'left', ...props }: TDProps) {
  return (
    <td className={cn('px-3 py-2 align-middle', alignClass[align], className)} {...props} />
  );
}
