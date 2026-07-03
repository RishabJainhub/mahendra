import Image from 'next/image';
import { cn } from '@/lib/utils';

type Props = {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  /** On dark backgrounds — logo sits on a white badge so the mark reads correctly */
  inverted?: boolean;
};

const SIZES = {
  xs: 28,
  sm: 36,
  md: 48,
  lg: 64,
  xl: 96,
} as const;

/** Company logo — octagonal MD mark from `/public/logo.png`. */
export function Logo({ size = 'md', className, inverted = false }: Props) {
  const px = SIZES[size];
  const pad = Math.max(2, Math.round(px * 0.08));

  const img = (
    <Image
      src="/logo.png"
      alt="Mahendra Distributors"
      width={px}
      height={px}
      className="object-contain"
      priority
    />
  );

  if (inverted) {
    return (
      <span
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-md bg-white',
          className
        )}
        style={{ padding: pad, width: px + pad * 2, height: px + pad * 2 }}
      >
        {img}
      </span>
    );
  }

  return (
    <span className={cn('inline-flex shrink-0', className)} style={{ width: px, height: px }}>
      {img}
    </span>
  );
}
