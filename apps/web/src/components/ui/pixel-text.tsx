import type { ElementType } from 'react';
import { cn } from '../../lib/cn';
import { PixelDigits } from './pixel-digits';

/** Silkscreen só fica nítida na grade de 8px. */
export type PixelSize = 16 | 24 | 32;

const SIZE_CLASS: Record<PixelSize, string> = {
  16: 'text-pixel-sm',
  24: 'text-pixel-md',
  32: 'text-pixel-lg',
};

const NUMBER = /(\d+(?:,\d+)*)/;

type PixelTextProps = {
  children: string;
  size?: PixelSize;
  as?: ElementType;
  /** Deixa quebrar linha (títulos). Por padrão o texto pixel não quebra. */
  wrap?: boolean;
  className?: string;
};

/**
 * Texto de interface em pixel: títulos, botões, abas, selos, nomes. Caixa alta, sem abreviar.
 * Os números dentro do texto viram dígitos pixel ("RODADA 12"), na escala do tamanho (16 → 2, 24 → 3, 32 → 4).
 * A cor vem de `text-*` no className.
 */
export function PixelText({
  children,
  size = 16,
  as: Tag = 'span',
  wrap,
  className,
}: PixelTextProps) {
  const parts = children.split(NUMBER);
  const base = cn(
    'pixel',
    SIZE_CLASS[size],
    wrap ? 'whitespace-normal' : 'whitespace-nowrap',
    className,
  );

  if (parts.length === 1) return <Tag className={base}>{children}</Tag>;

  const scale = Math.max(size / 8, 2);
  return (
    <Tag className={cn(base, 'inline-flex items-baseline', wrap && 'flex-wrap')}>
      <span className="sr-only">{children}</span>
      {parts.map((part, i) =>
        !part ? null : i % 2 ? (
          <PixelDigits key={i} value={part} scale={scale} className="self-center" />
        ) : (
          <span key={i} aria-hidden className="whitespace-pre">
            {part}
          </span>
        ),
      )}
    </Tag>
  );
}
