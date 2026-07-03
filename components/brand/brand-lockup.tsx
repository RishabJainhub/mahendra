import { APP_NAME, APP_SHORT_NAME } from '@/lib/brand';
import { cn } from '@/lib/utils';
import { Logo } from './logo';

type Props = {
  /** Show full company name or short */
  name?: 'full' | 'short';
  size?: 'sm' | 'md' | 'lg';
  /** Light text for dark backgrounds */
  inverted?: boolean;
  subtitle?: string;
  className?: string;
};

export function BrandLockup({
  name = 'full',
  size = 'md',
  inverted = false,
  subtitle,
  className,
}: Props) {
  const logoSize = size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : 'md';
  const displayName = name === 'short' ? APP_SHORT_NAME : APP_NAME;

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <Logo
        size={logoSize}
        inverted={inverted}
      />
      <div className="min-w-0">
        <div
          className={cn(
            'font-semibold leading-tight tracking-tight',
            size === 'sm' && 'text-sm',
            size === 'md' && 'text-base',
            size === 'lg' && 'text-xl',
            inverted ? 'text-white' : 'text-foreground'
          )}
        >
          {displayName}
        </div>
        {subtitle && (
          <div
            className={cn(
              'mt-0.5 text-xs leading-snug',
              inverted ? 'text-white/60' : 'text-muted-foreground'
            )}
          >
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}
