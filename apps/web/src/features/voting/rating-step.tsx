import { POSITION_LABELS, TEAM_LABELS, type VotingPlayer } from '@fut-stats/shared';
import { Avatar } from '../../components/ui/avatar';
import { Bump } from '../../components/ui/bump';
import { Button } from '../../components/ui/button';
import { Icon } from '../../components/ui/icons';
import { PixelDigits } from '../../components/ui/pixel-digits';
import { PixelText } from '../../components/ui/pixel-text';
import { cn } from '../../lib/cn';
import { formatRating } from '../../lib/rating-format';
import { ratingPhrase } from './rating-phrase';
import { stepRating } from './rating-scale';
import { RatingSlider } from './rating-slider';
import { StepBar, StepCard } from './step-card';
import { FIRST_RATING } from './vote-flow';

type RatingStepProps = {
  player: VotingPlayer;
  /** Posição do jogador entre os que recebem nota (começa em 0). */
  index: number;
  total: number;
  ratedCount: number;
  value: number | null;
  /** Veio de uma linha da revisão: o botão confirma e volta a ela. */
  backToReview: boolean;
  onRate: (value: number) => void;
  onNext: () => void;
  onPrevious: () => void;
};

/**
 * Card de nota (folha: Card/Nota): o rosto, a nota em dígitos pixel com − e + de 64 px, a régua e "Próximo jogador".
 * A nota nasce vazia e a primeira batida parte de 6,0; sem nota não se avança (não dá para pular). Até 10 letras
 * de apelido cabem inteiras em 320 px.
 */
export function RatingStep({
  player,
  index,
  total,
  ratedCount,
  value,
  backToReview,
  onRate,
  onNext,
  onPrevious,
}: RatingStepProps) {
  const last = index === total - 1;
  const label = `Nota de ${player.nickname}`;
  const bump = (direction: 1 | -1) => {
    if (value === null) return onRate(FIRST_RATING);
    const next = stepRating(value, direction);
    if (next !== null) onRate(next);
  };

  return (
    <StepCard label="Dar nota">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          {index > 0 || backToReview ? (
            <button
              type="button"
              onClick={onPrevious}
              className="-ml-2 inline-flex min-h-11 items-center gap-1 pr-2 pl-1"
            >
              <Icon name="chevronLeft" size={18} />
              <PixelText>{backToReview ? 'Revisão' : 'Anterior'}</PixelText>
            </button>
          ) : (
            <span />
          )}
          <PixelText size={24}>{`${index + 1} de ${total}`}</PixelText>
        </div>
        <StepBar done={ratedCount} total={total} />
      </div>

      {/* A cada jogador a linha entra de lado em degraus (200 ms), sem repetir o quadro todo */}
      <div key={player.membershipId} className="animate-row-in flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <Avatar
            nickname={player.nickname}
            avatar={player.avatar}
            team={player.team === 'WHITE' ? 'white' : 'black'}
            size={56}
            gap="surface-raised"
            goalkeeper={player.position === 'GOALKEEPER'}
            className="m-1"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <PixelText as="h2" wrap className="outline-none">
              {player.nickname}
            </PixelText>
            <PixelText wrap className="text-text-muted">
              {`${POSITION_LABELS[player.position]} · ${TEAM_LABELS[player.team]}`}
            </PixelText>
          </div>
        </div>

        <div role="group" aria-label={label} className="flex flex-col items-center gap-3">
          <div className="flex w-full items-center justify-between gap-2">
            <StepKey
              icon="minus"
              label="Diminuir 0,5"
              disabled={value !== null && stepRating(value, -1) === null}
              onClick={() => bump(-1)}
            />
            <Bump value={value ?? 'vazio'} scale={1.2} origin="50% 100%">
              <RatingDigits value={value} label={label} />
            </Bump>
            <StepKey
              icon="plus"
              label="Aumentar 0,5"
              disabled={value !== null && stepRating(value, 1) === null}
              onClick={() => bump(1)}
            />
          </div>
          <div aria-live="polite" className="text-center text-text-muted">
            <PixelText wrap>
              {value === null ? 'Dê uma nota de 0 a 10' : ratingPhrase(value)}
            </PixelText>
          </div>
        </div>

        <RatingSlider label={label} value={value} onChange={onRate} />
      </div>

      <p className="flex items-center gap-2 text-sm text-text-muted">
        <Icon name="lock" size={14} className="shrink-0" />
        Seu voto é anônimo. Só a média aparece.
      </p>
      <Button
        label={
          value === null
            ? 'Dê uma nota para continuar'
            : backToReview
              ? 'Confirmar nota'
              : last
                ? 'Revisar'
                : 'Próximo jogador'
        }
        block
        disabled={value === null}
        onClick={onNext}
      />
    </StepCard>
  );
}

/** A nota grande. "10,0" é a mais larga: em tela estreita (320) os dígitos descem uma escala para caber. */
function RatingDigits({ value, label }: { value: number | null; label: string }) {
  if (value === null) {
    return (
      <span
        role="img"
        aria-label={`${label}: ainda sem nota`}
        className="flex h-[72px] items-center"
      >
        <span className="block h-3 w-10 bg-border-strong" />
      </span>
    );
  }
  const text = formatRating(value);
  const wide = value === 10;
  return (
    <>
      <PixelDigits
        value={text}
        scale={wide ? 5 : 8}
        label={`${label}: ${text}`}
        className={cn('max-[359px]:hidden')}
      />
      <PixelDigits value={text} scale={wide ? 4 : 5} decorative className="min-[360px]:hidden" />
    </>
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
      className="inline-flex size-16 shrink-0 items-center justify-center bg-surface-3 text-text shadow-float transition-[translate,box-shadow] duration-(--duration-fast) ease-out active:translate-x-1 active:translate-y-1 active:shadow-card disabled:bg-surface disabled:text-disabled disabled:shadow-card"
    >
      <Icon name={icon} size={26} strokeWidth={2.6} />
    </button>
  );
}
