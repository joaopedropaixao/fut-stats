import { TEAM_LABELS, type VotingPlayer } from '@fut-stats/shared';
import { Avatar } from '../../components/ui/avatar';
import { Badge, Star, Stilts } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { PixelText } from '../../components/ui/pixel-text';
import { cn } from '../../lib/cn';
import { StepCard, StepHeader } from './step-card';

export type PickKind = 'mvp' | 'flop';

type PickStepProps = {
  kind: PickKind;
  players: readonly VotingPlayer[];
  chosenId: string | null;
  /** No passo do Perna de Pau: o Craque escolhido aparece travado ("Já é seu craque"). */
  lockedId?: string | null;
  sending?: boolean;
  onPick: (id: string) => void;
  onBack: () => void;
  onNext: () => void;
};

const COPY: Record<PickKind, { title: string; help: string; next: string }> = {
  mvp: {
    title: 'Quem foi o craque?',
    help: 'Escolha um jogador. Você não aparece na lista. Craque é obrigatório.',
    next: 'Próximo',
  },
  flop: {
    title: 'E o perna de pau?',
    help: 'Precisa ser outro jogador. Perna de pau é obrigatório.',
    next: 'Enviar votos',
  },
};

const RING: Record<PickKind, string> = {
  mvp: 'shadow-[inset_0_0_0_3px_var(--color-gold)] bg-gold/8',
  flop: 'shadow-[inset_0_0_0_3px_var(--color-flop)] bg-flop/8',
};

/**
 * Voto em 2 passos (folha: Card/Voto passo 1 e 2): a lista de quem pode receber o prêmio. A escolha tem contorno
 * de 3 px, selo com ícone e a palavra "ESCOLHIDO" (não depende de cor). O time vem escrito em cada linha.
 */
export function PickStep({
  kind,
  players,
  chosenId,
  lockedId,
  sending,
  onPick,
  onBack,
  onNext,
}: PickStepProps) {
  const copy = COPY[kind];
  return (
    <StepCard label={copy.title}>
      <StepHeader step={kind === 'mvp' ? 1 : 2} />
      <div className="flex items-start gap-3">
        <span className="mt-1 shrink-0">
          {kind === 'mvp' ? <Star size={26} /> : <Stilts size={26} />}
        </span>
        <div className="flex min-w-0 flex-col gap-2">
          <PixelText as="h2" size={24} wrap className={kind === 'mvp' ? 'text-gold' : 'text-flop'}>
            {copy.title}
          </PixelText>
          <p className="text-sm text-text-muted">{copy.help}</p>
        </div>
      </div>

      <div role="radiogroup" aria-label={copy.title} className="flex flex-col gap-2.5">
        {players.map((player) => {
          const chosen = chosenId === player.membershipId;
          const locked = lockedId === player.membershipId;
          return (
            <button
              key={player.membershipId}
              type="button"
              role="radio"
              aria-checked={chosen}
              disabled={locked}
              onClick={() => onPick(player.membershipId)}
              className={cn(
                'flex min-h-16 w-full items-center gap-3 px-3 py-2 text-left',
                chosen ? RING[kind] : 'shadow-card active:bg-highlight',
                locked && 'opacity-70',
              )}
            >
              <Avatar
                nickname={player.nickname}
                avatar={player.avatar}
                team={player.team === 'WHITE' ? 'white' : 'black'}
                size={40}
                gap="surface-raised"
                className="m-1"
              />
              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                <PixelText wrap>{player.nickname}</PixelText>
                <PixelText className="text-text-muted">{TEAM_LABELS[player.team]}</PixelText>
                {chosen && (
                  <Badge
                    variant={kind === 'mvp' ? 'craque' : 'flop'}
                    label="Escolhido"
                    className="self-start"
                  />
                )}
                {locked && (
                  <span className="inline-flex items-start gap-1.5 text-gold">
                    <Star size={16} />
                    <PixelText wrap>Já é seu craque</PixelText>
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex gap-3">
        <Button variant="outline" size={52} label="Voltar" className="flex-1" onClick={onBack} />
        <Button
          label={copy.next}
          className="flex-1"
          disabled={chosenId === null}
          loading={sending}
          onClick={onNext}
        />
      </div>
    </StepCard>
  );
}
