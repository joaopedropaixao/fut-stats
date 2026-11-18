import type { ReactNode } from 'react';
import { PixelText } from '../../components/ui/pixel-text';
import { cn } from '../../lib/cn';

type Option<T extends string> = { value: T; label: string };

type SegmentedProps<T extends string> = {
  /** O nome do grupo para leitor de tela ("Ranking", "Posição"). */
  label: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Como as opções se espalham: uma linha só ou grade (a de posição vira 2 x 2 em tela estreita). */
  className?: string;
  children?: ReactNode;
};

/**
 * Seletor segmentado (folha: Abas/Ranking, 44 px de altura), radiogroup nativo como o `TeamSegmented`: as setas trocam
 * a opção e levam o foco junto. A escolhida ganha o fundo elevado e o contorno forte.
 */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: SegmentedProps<T>) {
  const move = (step: 1 | -1, root: HTMLElement) => {
    const at = options.findIndex((o) => o.value === value);
    const next = options[(at + step + options.length) % options.length]!;
    onChange(next.value);
    root.querySelector<HTMLElement>(`[data-value="${next.value}"]`)?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('gap-1 bg-surface p-1 shadow-card', className)}
      onKeyDown={(e) => {
        if (['ArrowRight', 'ArrowDown'].includes(e.key)) {
          e.preventDefault();
          move(1, e.currentTarget);
        } else if (['ArrowLeft', 'ArrowUp'].includes(e.key)) {
          e.preventDefault();
          move(-1, e.currentTarget);
        }
      }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            data-value={option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex h-11 items-center justify-center transition-colors duration-(--duration-fast) ease-out',
              selected
                ? 'bg-surface-3 text-text shadow-[inset_0_0_0_2px_var(--color-border-strong)]'
                : 'text-text-muted active:bg-highlight',
            )}
          >
            <PixelText>{option.label}</PixelText>
          </button>
        );
      })}
    </div>
  );
}
