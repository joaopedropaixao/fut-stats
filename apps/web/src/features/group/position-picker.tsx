import { POSITION_LABELS, positionSchema } from '@fut-stats/shared';
import { useId } from 'react';
import type { z } from 'zod';
import { cn } from '../../lib/cn';
import { Icon } from '../../components/ui/icons';
import { PixelText } from '../../components/ui/pixel-text';

export type Position = z.infer<typeof positionSchema>;

type PositionPickerProps = {
  value: Position | null;
  onChange: (position: Position) => void;
  error?: string;
};

/**
 * Escolha da posição principal, na lista de opções da folha ("Escolha o dia"): a escolhida ganha contorno
 * creme e ✓ (cor nunca é o único sinal). Rádio nativo: as setas do teclado trocam a opção.
 */
export function PositionPicker({ value, onChange, error }: PositionPickerProps) {
  const id = useId();
  const errorId = `${id}-erro`;
  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={error ? errorId : undefined}>
      <legend className="mb-2">
        <PixelText>Sua posição</PixelText>
      </legend>
      <div
        className={cn(
          'flex flex-col bg-surface',
          error ? 'shadow-[inset_0_0_0_2px_var(--color-danger)]' : 'shadow-card',
        )}
      >
        {positionSchema.options.map((position, i) => {
          const selected = value === position;
          return (
            <label
              key={position}
              className={cn(
                'flex h-12 cursor-pointer items-center justify-between px-4',
                'has-focus-visible:outline-2 has-focus-visible:-outline-offset-4 has-focus-visible:outline-text',
                selected
                  ? 'bg-highlight shadow-[inset_0_0_0_2px_var(--color-text)]'
                  : i > 0 && 'shadow-[inset_0_2px_0_0_var(--color-border)]',
              )}
            >
              <input
                type="radio"
                name={id}
                value={position}
                checked={selected}
                onChange={() => onChange(position)}
                className="sr-only"
              />
              <PixelText>{POSITION_LABELS[position]}</PixelText>
              {selected && (
                <Icon name="check" size={20} strokeWidth={2.4} className="text-success" />
              )}
            </label>
          );
        })}
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-caption text-[#fca5a5]">
          {error}
        </p>
      )}
    </fieldset>
  );
}
