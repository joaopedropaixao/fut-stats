import { POSITION_LABELS, positionSchema } from '@fut-stats/shared';
import type { z } from 'zod';
import { cn } from '../../lib/cn';
import { Icon } from '../../components/ui/icons';
import { PixelText } from '../../components/ui/pixel-text';

type Position = z.infer<typeof positionSchema>;

type PositionPickerProps = {
  value: Position | null;
  onChange: (position: Position) => void;
  error?: string;
};

/** Escolha da posição principal: uma opção por vez, com ✓ na escolhida (cor nunca é o único sinal). */
export function PositionPicker({ value, onChange, error }: PositionPickerProps) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2">
        <PixelText>Sua posição</PixelText>
      </legend>
      <div role="radiogroup" aria-label="Sua posição" className="flex flex-col gap-2">
        {positionSchema.options.map((position) => {
          const selected = value === position;
          return (
            <button
              key={position}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(position)}
              className={cn(
                'flex h-12 items-center justify-between px-4 text-text',
                selected
                  ? 'bg-highlight shadow-[inset_0_0_0_2px_var(--color-text)]'
                  : 'bg-surface shadow-card',
              )}
            >
              <PixelText>{POSITION_LABELS[position].toUpperCase()}</PixelText>
              {selected && <Icon name="check" size={20} strokeWidth={2.4} />}
            </button>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="text-caption text-[#fca5a5]">
          {error}
        </p>
      )}
    </fieldset>
  );
}
