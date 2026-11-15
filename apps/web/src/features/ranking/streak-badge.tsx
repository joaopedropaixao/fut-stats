import type { Streak } from '@fut-stats/shared';
import { PixelText } from '../../components/ui/pixel-text';
import { cn } from '../../lib/cn';
import { streakView } from './ranking-text';

const TONE: Record<Streak['result'], string> = {
  WIN: 'text-success shadow-[inset_0_0_0_2px_var(--color-success)] bg-success/10',
  LOSS: 'text-[#f87171] shadow-[inset_0_0_0_2px_var(--color-danger)] bg-danger/10',
  DRAW: 'text-text shadow-card',
};

/** "▲ 3 VITÓRIAS SEGUIDAS": só a partir de 2 resultados iguais seguidos. A forma (▲ ▼ =) diz o tipo, não só a cor. */
export function StreakBadge({ streak }: { streak: Streak | null }) {
  const view = streakView(streak);
  if (!streak || !view) return null;
  return (
    <p className={cn('flex min-h-11 items-center gap-2 px-3 py-2', TONE[streak.result])}>
      <span aria-hidden className="pixel text-pixel-sm">
        {view.mark}
      </span>
      <PixelText wrap>{view.text}</PixelText>
    </p>
  );
}
