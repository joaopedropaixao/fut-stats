import { POSITION_LABELS, positionSchema } from '@fut-stats/shared';
import { useId } from 'react';
import { Icon } from '../../components/ui/icons';
import { PixelText } from '../../components/ui/pixel-text';
import { cn } from '../../lib/cn';
import type { Position } from './position-picker';
import {
  MAX_SECONDARY_POSITIONS,
  positionsErrorText,
  toggleSecondary,
  type PositionsError,
} from './secondary-positions';

type SecondaryPickerProps = {
  primary: Position;
  value: readonly Position[];
  onChange: (value: Position[]) => void;
  /** Por que a última marcação não valeu ("No máximo 2 posições secundárias"). */
  error: PositionsError | null;
  onError: (error: PositionsError | null) => void;
};

/**
 * Posições secundárias: a mesma lista da principal, em modo múltiplo (caixas de marcar). A principal aparece
 * com o selo "PRINCIPAL" (texto, não só cor) e não marca; a terceira não marca e a tela explica por quê.
 * Com Goleiro como principal não há secundárias: "Goleiro joga só no gol".
 */
export function SecondaryPicker({ primary, value, onChange, error, onError }: SecondaryPickerProps) {
  const id = useId();
  const errorId = `${id}-erro`;

  if (primary === 'GOALKEEPER') {
    return (
      <div className="flex flex-col gap-2">
        <PixelText as="p">Também joga de</PixelText>
        <p className="flex items-start gap-2 bg-surface p-4 text-sm text-text-muted shadow-card">
          <Icon name="lock" size={18} className="mt-0.5 shrink-0" />
          {positionsErrorText('GOALKEEPER_HAS_SECONDARY')}
        </p>
      </div>
    );
  }

  const options = positionSchema.options.filter((position) => position !== 'GOALKEEPER');
  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={error ? errorId : undefined}>
      <legend className="mb-2 flex w-full items-center justify-between gap-3">
        <PixelText>Também joga de</PixelText>
        <PixelText className="text-text-muted">{`${value.length} de ${MAX_SECONDARY_POSITIONS}`}</PixelText>
      </legend>
      <div className="flex flex-col bg-surface shadow-card">
        {options.map((position, i) => {
          const isPrimary = position === primary;
          const selected = value.includes(position);
          return (
            <label
              key={position}
              className={cn(
                'flex h-12 items-center justify-between gap-2 px-4',
                isPrimary ? 'cursor-not-allowed' : 'cursor-pointer',
                'has-focus-visible:outline-2 has-focus-visible:-outline-offset-4 has-focus-visible:outline-text',
                selected
                  ? 'bg-highlight shadow-[inset_0_0_0_2px_var(--color-text)]'
                  : i > 0 && 'shadow-[inset_0_2px_0_0_var(--color-border)]',
              )}
            >
              <input
                type="checkbox"
                value={position}
                checked={selected}
                disabled={isPrimary}
                onChange={() => {
                  const next = toggleSecondary(value, position, primary);
                  onError(next.error);
                  onChange(next.secondaries);
                }}
                className="sr-only"
              />
              <PixelText className={isPrimary ? 'text-text-muted' : undefined}>
                {POSITION_LABELS[position]}
              </PixelText>
              {isPrimary ? (
                <span className="inline-flex h-6 items-center px-1.5 text-text-muted shadow-card">
                  <PixelText>Principal</PixelText>
                </span>
              ) : (
                selected && <Icon name="check" size={20} strokeWidth={2.4} className="text-success" />
              )}
            </label>
          );
        })}
      </div>
      {error && (
        <p id={errorId} role="alert" className="flex items-start gap-2 text-caption text-[#fca5a5]">
          <Icon name="alert" size={16} className="mt-px shrink-0" />
          {positionsErrorText(error)}
        </p>
      )}
    </fieldset>
  );
}
