'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastVariant = 'default' | 'success' | 'destructive';

type ToastOptions = {
  title?: string;
  description?: string;
  variant?: ToastVariant;
  /** Optional action button (e.g. Undo). The toast closes after the click. */
  action?: { label: string; onClick: () => void | Promise<void> };
  /** Auto-dismiss delay in ms. Defaults to 4000 (6000 when an action is present). */
  duration?: number;
};

type ToastItem = ToastOptions & {
  id: number;
};

type ToastContextValue = {
  toast: (opts: ToastOptions) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

const variantBorderClass: Record<ToastVariant, string> = {
  default: 'border-l-border',
  success: 'border-l-primary',
  destructive: 'border-l-destructive',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const idRef = React.useRef(0);

  const remove = React.useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = React.useCallback(
    (opts: ToastOptions) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { ...opts, id }]);
      const duration = opts.duration ?? (opts.action ? 6000 : 4000);
      window.setTimeout(() => remove(id), duration);
    },
    [remove]
  );

  const value = React.useMemo<ToastContextValue>(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="fixed top-4 right-4 z-[100] flex w-80 flex-col gap-2"
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => {
            const variant: ToastVariant = t.variant ?? 'default';
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 24 }}
                transition={{ duration: 0.18 }}
                className={cn(
                  'relative rounded-lg border border-border border-l-4 bg-card p-3 pr-8 shadow-md',
                  variantBorderClass[variant]
                )}
                role="status"
              >
                <button
                  type="button"
                  onClick={() => remove(t.id)}
                  aria-label="Close notification"
                  className="absolute top-2 right-2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                {t.title && <div className="text-sm font-medium text-foreground">{t.title}</div>}
                {t.description && (
                  <div className="text-sm text-muted-foreground">{t.description}</div>
                )}
                {t.action && (
                  <button
                    type="button"
                    onClick={() => {
                      void t.action?.onClick();
                      remove(t.id);
                    }}
                    className="mt-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium hover:bg-accent"
                  >
                    {t.action.label}
                  </button>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  return React.useMemo<ToastContextValue>(
    () => ctx ?? { toast: () => {} },
    [ctx]
  );
}
