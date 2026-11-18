import type { CSSProperties } from 'react';

/** O quadro da linha (56 px, contorno neutro de 2 px, sombra dura, entrada em degraus): as linhas do aparelho usam o mesmo. */
export const ALERT_LINE_CLASS =
  'animate-row-in flex min-h-14 items-stretch gap-3 bg-surface-raised pr-3 active:translate-x-1 active:translate-y-1 active:shadow-none';

export function alertLineStyle(index: number): CSSProperties {
  return {
    '--moment-delay': `${index * 80}ms`,
    boxShadow: 'inset 0 0 0 2px var(--color-border-strong), 3px 3px 0 var(--color-shadow)',
  } as CSSProperties;
}
