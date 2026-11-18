import type { CSSProperties } from 'react';
import { PixelDigits } from '../../components/ui/pixel-digits';
import { cn } from '../../lib/cn';
import { breakable } from './ranking-text';

export type StatCell = {
  label: string;
  /** Já formatado no padrão do app ("12", "1,7"). */
  value: string | number;
};

type StatsGridProps = {
  cells: readonly StatCell[];
  className?: string;
};

/**
 * A grade de estatísticas: número em dígitos pixel e rótulo por extenso. 2 colunas em 320 px e 4 a partir de 390 px.
 * É um card de grande momento (contorno de 3 px, sombra dura, entrada em degraus). Reusada no Perfil.
 */
export function StatsGrid({ cells, className }: StatsGridProps) {
  return (
    <dl
      style={{ '--moment-delay': '120ms' } as CSSProperties}
      className={cn(
        'moment-frame animate-moment-in grid grid-cols-2 gap-0.5 bg-border-strong min-[390px]:grid-cols-4',
        className,
      )}
    >
      {cells.map((cell) => (
        <div
          key={cell.label}
          className="flex min-w-0 flex-col-reverse items-center justify-between gap-2 bg-surface-raised px-2 py-3"
        >
          <dt className="min-h-9 text-center text-[13px] leading-4.5 font-semibold text-text-muted uppercase">
            {breakable(cell.label)}
          </dt>
          <dd className="m-0 flex h-9 items-center">
            <PixelDigits value={cell.value} scale={4} label={`${cell.value}`} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
