import { Icon } from '../../components/ui/icons';
import { cn } from '../../lib/cn';
import type { ResultKind } from './history-text';

/** A marca do resultado de quem vê, sempre ao lado do texto: ✓ vitória, ✕ derrota, = empate, − não jogou. */
export function ResultMark({ kind, className }: { kind: ResultKind; className?: string }) {
  if (kind === 'DRAW') {
    return (
      <span aria-hidden className={cn('flex w-4 shrink-0 flex-col gap-1', className)}>
        <span className="h-0.75 bg-current" />
        <span className="h-0.75 bg-current" />
      </span>
    );
  }
  const name = kind === 'WIN' ? 'check' : kind === 'LOSS' ? 'x' : 'minus';
  return <Icon name={name} size={20} strokeWidth={3.5} className={className} />;
}
