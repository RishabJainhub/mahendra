'use client';

import * as React from 'react';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export type ActionMenuItem = {
  label: string;
  icon?: React.ReactNode;
  onSelect: () => void;
  /** Renders in destructive red and separated from the other items. */
  destructive?: boolean;
  disabled?: boolean;
};

type Props = {
  items: ActionMenuItem[];
  /** Accessible label for the trigger button. */
  label?: string;
  size?: 'sm' | 'default';
};

/**
 * Minimal "⋯" dropdown for row/header actions. Callback-based items only —
 * confirm dialogs belong to the parent so they survive the menu closing.
 */
export function ActionMenu({ items, label = 'More actions', size = 'sm' }: Props) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const normal = items.filter((i) => !i.destructive);
  const destructive = items.filter((i) => i.destructive);

  return (
    <div ref={ref} className="relative inline-block text-left">
      <Button
        type="button"
        variant="outline"
        size={size}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1 w-48 overflow-hidden rounded-md border bg-card py-1 shadow-lg"
        >
          {normal.map((item) => (
            <MenuRow key={item.label} item={item} close={() => setOpen(false)} />
          ))}
          {normal.length > 0 && destructive.length > 0 && <div className="my-1 border-t" />}
          {destructive.map((item) => (
            <MenuRow key={item.label} item={item} close={() => setOpen(false)} />
          ))}
        </div>
      )}
    </div>
  );
}

function MenuRow({ item, close }: { item: ActionMenuItem; close: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={item.disabled}
      onClick={() => {
        close();
        item.onSelect();
      }}
      className={cn(
        'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50',
        item.destructive && 'text-destructive hover:bg-destructive/10'
      )}
    >
      {item.icon}
      {item.label}
    </button>
  );
}
