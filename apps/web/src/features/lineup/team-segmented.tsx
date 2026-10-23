import { TEAM_LABELS } from '@fut-stats/shared';
import { PixelText } from '../../components/ui/pixel-text';
import { cn } from '../../lib/cn';
import { TEAM_KEYS, type TeamKey } from './lineup-draft';

type TeamSegmentedProps = { value: TeamKey; onChange: (team: TeamKey) => void };

/** Seletor Branco / Preto (segmentado, 44px de altura). Escolhido = a cor do próprio time. */
export function TeamSegmented({ value, onChange }: TeamSegmentedProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Time"
      className="flex gap-1 bg-surface p-1 shadow-[inset_0_0_0_2px_var(--color-border-strong)]"
    >
      {TEAM_KEYS.map((team) => {
        const selected = team === value;
        return (
          <button
            key={team}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(team)}
            className={cn(
              'flex h-11 flex-1 items-center justify-center',
              selected && team === 'WHITE' && 'bg-team-white text-team-black',
              selected &&
                team === 'BLACK' &&
                'bg-team-black text-team-white shadow-[inset_0_0_0_2px_rgb(255_255_255/35%)]',
              !selected && 'text-text-muted',
            )}
          >
            <PixelText>{TEAM_LABELS[team]}</PixelText>
          </button>
        );
      })}
    </div>
  );
}
