import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

type TurfProps = {
  children?: ReactNode;
  className?: string;
  'aria-hidden'?: boolean;
};

/**
 * Uma nesga de gramado com linha de giz (a risca do meio-campo e o círculo), para o boneco ficar "em campo":
 * o montador do bonequinho e a figurinha. Contorno preto de 3 px como o campo dos times. É decorativo.
 */
export function Turf({ children, className, 'aria-hidden': hidden }: TurfProps) {
  return (
    <div
      aria-hidden={hidden}
      className={cn(
        'relative overflow-hidden bg-linear-to-b from-[#1f5a33] to-field shadow-[inset_0_0_0_3px_#000]',
        className,
      )}
    >
      <svg
        aria-hidden
        viewBox="0 0 300 220"
        preserveAspectRatio="xMidYMax slice"
        fill="none"
        strokeWidth={2}
        className="pointer-events-none absolute inset-0 size-full stroke-chalk"
      >
        <line x1="-20" y1="150" x2="320" y2="150" />
        <circle cx="150" cy="150" r="70" />
      </svg>
      {children}
    </div>
  );
}
