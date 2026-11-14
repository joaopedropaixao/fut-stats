import { ratingSchema } from '@fut-stats/shared';
import { Bump } from '../../components/ui/bump';
import { Icon } from '../../components/ui/icons';
import { PixelDigits } from '../../components/ui/pixel-digits';
import { PixelText } from '../../components/ui/pixel-text';
import { formatRating } from '../../lib/rating-format';

/** A nota anda de 0,5 em 0,5; o limite (0 a 10) e o passo válido são do contrato (`ratingSchema`). */
const STEP = 0.5;

type RatingStepperProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
};

/**
 * A nota inicial no − / + da folha (Stepper/Menos e Stepper/Mais: teclas de 56 x 56): o dígito grande "bate"
 * a cada mudança. Os botões apagam no limite (a trava é o `ratingSchema`, não um número aqui).
 */
export function RatingStepper({ label, value, onChange }: RatingStepperProps) {
  const lower = value - STEP;
  const higher = value + STEP;
  const canLower = ratingSchema.safeParse(lower).success;
  const canRaise = ratingSchema.safeParse(higher).success;
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-3">
      <PixelText>{label}</PixelText>
      <div className="flex items-center justify-between gap-3">
        <StepKey
          icon="minus"
          label="Diminuir 0,5"
          disabled={!canLower}
          onClick={() => onChange(lower)}
        />
        <Bump value={value} scale={1.25} origin="50% 100%">
          <span role="status">
            <PixelDigits
              value={formatRating(value)}
              scale={6}
              label={`${label}: ${formatRating(value)}`}
            />
          </span>
        </Bump>
        <StepKey
          icon="plus"
          label="Aumentar 0,5"
          disabled={!canRaise}
          onClick={() => onChange(higher)}
        />
      </div>
    </div>
  );
}

function StepKey({
  icon,
  label,
  disabled,
  onClick,
}: {
  icon: 'minus' | 'plus';
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex size-14 shrink-0 items-center justify-center bg-surface-3 text-text shadow-float transition-[translate,box-shadow] duration-(--duration-fast) ease-out active:translate-x-1 active:translate-y-1 active:shadow-card disabled:bg-surface disabled:text-disabled disabled:shadow-card"
    >
      <Icon name={icon} size={22} strokeWidth={2.6} />
    </button>
  );
}
