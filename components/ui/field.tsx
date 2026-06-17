import { cn } from '@/lib/utils';

export function Label({
  htmlFor,
  children,
  className,
}: {
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={cn('mb-1 block text-sm font-medium', className)}>
      {children}
    </label>
  );
}

export function SelectField({
  name,
  id,
  defaultValue,
  value,
  onChange,
  disabled,
  children,
  className,
}: {
  name?: string;
  id?: string;
  defaultValue?: string;
  value?: string;
  onChange?: React.ChangeEventHandler<HTMLSelectElement>;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <select
      name={name}
      id={id}
      defaultValue={defaultValue}
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={cn(
        'h-10 w-full rounded-md border border-border bg-white px-3 text-sm text-slate-950 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500',
        className
      )}
    >
      {children}
    </select>
  );
}
