import type { ElementType, ReactNode } from 'react';
import { cn } from '../../lib/cn';

/**
 * Superfície com contorno: 1 = listas, 2 = cards, 3 = o que flutua (aviso, gaveta, menu), com sombra dura.
 * Canto reto sempre.
 */
type SurfaceProps = {
  level?: 1 | 2 | 3;
  as?: ElementType;
  className?: string;
  children?: ReactNode;
};

const LEVEL = {
  1: 'bg-surface shadow-card',
  2: 'bg-surface-raised shadow-card',
  3: 'bg-surface-3 shadow-float',
} as const;

export function Surface({ level = 1, as: Tag = 'div', className, children }: SurfaceProps) {
  return <Tag className={cn(LEVEL[level], className)}>{children}</Tag>;
}
