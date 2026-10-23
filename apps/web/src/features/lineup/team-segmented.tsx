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
      className="flex gap-1 bg-surface p-1 shadow-card"
      onKeyDown={(e) => {
        // Radiogroup: as setas trocam o time e levam o foco junto
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
        e.preventDefault();
        const next = TEAM_KEYS.find((t) => t !== value)!;
        onChange(next);
        e.currentTarget.querySelector<HTMLElement>(`[data-team="${next}"]`)?.focus();
      }}
    >
      {TEAM_KEYS.map((team) => {
        const selected = team === value;
        return (
          <button
            key={team}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            data-team={team}
            onClick={() => onChange(team)}
            className={cn(
              'flex h-11 flex-1 items-center justify-center transition-colors duration-(--duration-fast) ease-out',
              selected && team === 'WHITE' && 'bg-team-white text-team-black',
              selected &&
                team === 'BLACK' &&
                'bg-team-black text-team-white shadow-[inset_0_0_0_2px_rgb(255_255_255/35%)]',
              !selected && 'text-text-muted active:bg-highlight',
            )}
          >
            <PixelText>{TEAM_LABELS[team]}</PixelText>
          </button>
        );
      })}
    </div>
  );
}
