import type { VotingPlayer } from '@fut-stats/shared';
import { Avatar } from '../../components/ui/avatar';
import { Button } from '../../components/ui/button';
import { Icon } from '../../components/ui/icons';
import { PixelDigits } from '../../components/ui/pixel-digits';
import { PixelText } from '../../components/ui/pixel-text';
import { formatRating } from '../../lib/rating-format';
import { StepCard } from './step-card';

type ReviewStepProps = {
  players: readonly VotingPlayer[];
  ratings: Readonly<Record<string, number>>;
  onEdit: (index: number) => void;
  onContinue: () => void;
};

/**
 * Revisão antes de enviar (folha: Card/Revisão): todos com a nota e o lápis. Tocar numa linha volta àquele
 * jogador; ao confirmar a nota, retorna aqui. A linha inteira é o alvo de toque (64 px).
 */
export function ReviewStep({ players, ratings, onEdit, onContinue }: ReviewStepProps) {
  return (
    <StepCard label="Revisar notas">
      <PixelText as="h2" size={24} wrap>
        Revise antes de enviar
      </PixelText>
      <ul className="flex flex-col shadow-card">
        {players.map((player, index) => {
          const value = ratings[player.membershipId];
          const text = value === undefined ? '' : formatRating(value);
          return (
            <li
              key={player.membershipId}
              className="shadow-[inset_0_2px_0_0_var(--color-border)] first:shadow-none"
            >
              <button
                type="button"
                onClick={() => onEdit(index)}
                aria-label={`Mudar a nota de ${player.nickname}, hoje ${text}`}
                className="flex min-h-16 w-full items-center gap-3 px-3 py-2 text-left active:bg-highlight"
              >
                <Avatar
                  nickname={player.nickname}
                  avatar={player.avatar}
                  team={player.team === 'WHITE' ? 'white' : 'black'}
                  size={40}
                  gap="surface-raised"
                  className="m-1"
                />
                <span className="min-w-0 flex-1">
                  <PixelText wrap>{player.nickname}</PixelText>
                </span>
                <PixelDigits value={text} scale={3} decorative />
                <Icon name="pencil" size={18} className="text-text-muted" />
              </button>
            </li>
          );
        })}
      </ul>
      <Button label="Continuar para o voto" block onClick={onContinue} />
    </StepCard>
  );
}
