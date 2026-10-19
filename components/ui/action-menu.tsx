'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
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
 * Dynamic "⋯" dropdown menu for table rows and headers.
 * Uses a React Portal into document.body to prevent being clipped by parent overflow-hidden,
 * and dynamically flips upwards if clicked near the bottom of the viewport.
 */
export function ActionMenu({ items, label = 'More actions', size = 'sm' }: Props) {
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const [coords, setCoords] = React.useState<{
    top?: number;
    bottom?: number;
    right: number;
    maxHeight: number;
  } | null>(null);

  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = React.useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();

    // If button has scrolled off-screen, close the menu
    if (rect.bottom < 0 || rect.top > window.innerHeight) {
      setOpen(false);
      return;
    }

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    // Estimate ~38px per item + ~16px padding and borders
    const estimatedHeight = items.length * 38 + 24;
    const shouldOpenUp = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;

    const right = Math.max(8, window.innerWidth - rect.right);
    const maxHeight = Math.max(160, shouldOpenUp ? spaceAbove - 16 : spaceBelow - 16);

    if (shouldOpenUp) {
      setCoords({
        bottom: window.innerHeight - rect.top + 4,
        right,
        maxHeight,
      });
    } else {
      setCoords({
        top: rect.bottom + 4,
        right,
        maxHeight,
      });
    }
  }, [items.length]);

  React.useEffect(() => {
    if (!open) return;

    updatePosition();

    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    function onScrollOrResize() {
      updatePosition();
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [open, updatePosition]);

  const normal = items.filter((i) => !i.destructive);
  const destructive = items.filter((i) => i.destructive);

  return (
    <div className="relative inline-block text-left">
      <Button
        ref={buttonRef}
        type="button"
        variant="outline"
        size={size}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          if (!open) updatePosition();
          setOpen((v) => !v);
        }}
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>

      {open &&
        mounted &&
        coords &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{
              position: 'fixed',
              top: coords.top !== undefined ? `${coords.top}px` : undefined,
              bottom: coords.bottom !== undefined ? `${coords.bottom}px` : undefined,
              right: `${coords.right}px`,
              maxHeight: `${coords.maxHeight}px`,
            }}
            className="z-[9999] w-48 overflow-y-auto rounded-md border bg-card py-1 shadow-lg animate-in fade-in-0 zoom-in-95"
          >
            {normal.map((item) => (
              <MenuRow key={item.label} item={item} close={() => setOpen(false)} />
            ))}
            {normal.length > 0 && destructive.length > 0 && <div className="my-1 border-t" />}
            {destructive.map((item) => (
              <MenuRow key={item.label} item={item} close={() => setOpen(false)} />
            ))}
          </div>,
          document.body
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
