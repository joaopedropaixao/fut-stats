import { useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

type BumpProps = {
  /** O valor que, ao mudar, faz o filho bater. */
  value: string | number;
  children: ReactNode;
  className?: string;
  /** Quanto cresce no começo do bater (padrão 1,4; dígito grande pede menos). */
  scale?: number;
  /** Âncora do crescimento (padrão: embaixo no meio; texto largo ancora à esquerda). */
  origin?: string;
};

/**
 * Faz o filho "bater" (escala em 3 degraus, 220 ms) quando `value` muda. A primeira exibição não anima:
 * só a mudança conta. Com "reduzir movimento" a animação some sozinha (regra global do index.css).
 */
export function Bump({ value, children, className, scale, origin }: BumpProps) {
  const [seen, setSeen] = useState(value);
  const [bumps, setBumps] = useState(0);
  if (seen !== value) {
    setSeen(value);
    setBumps((n) => n + 1);
  }
  return (
    <span
      key={bumps}
      style={{ '--bump-scale': scale, '--bump-origin': origin } as CSSProperties}
      className={cn('inline-flex', bumps > 0 && 'animate-digit-bump', className)}
    >
      {children}
    </span>
  );
}
