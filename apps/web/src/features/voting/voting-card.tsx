import type { CSSProperties } from 'react';
import { Badge } from '../../components/ui/badge';
import { Icon } from '../../components/ui/icons';
import { PixelText } from '../../components/ui/pixel-text';
import { RouteButton } from '../rounds/route-button';
import { closesInLabel } from './deadline';
import { Meter } from './meter';
import { useVoting } from './queries';
import { useCountdown } from './use-countdown';

type VotingCardProps = {
  groupId: string;
  roundId: string;
  /** Só uma tecla amarela por tela: com o resultado em destaque, esta vira tecla de contorno. */
  yieldKey?: boolean;
};

/**
 * Início com votação aberta: grande momento neutro (contorno de 3px, sombra dura, entrada em degraus; sem laranja
 * nem ouro, que ficam com o card do pacote; só a tecla de ação é amarela), com o tipo escrito
 * ("VOTAÇÃO ABERTA" e o ícone da urna), a rodada, o prazo, o medidor e a tecla conforme o que a pessoa pode fazer.
 * Carrega sozinho; sem dado (carregando ou erro) o início segue sem o card.
 */
export function VotingCard({ groupId, roundId, yieldKey }: VotingCardProps) {
  const voting = useVoting(groupId, roundId);
  const view = voting.data;
  if (!view || view.status !== 'VOTING') return null;
  return <Loaded view={view} updatedAt={voting.dataUpdatedAt} yieldKey={yieldKey} />;
}

function Loaded({
  view,
  updatedAt,
  yieldKey,
}: {
  view: NonNullable<ReturnType<typeof useVoting>['data']>;
  updatedAt: number;
  yieldKey?: boolean;
}) {
  const remaining = useCountdown(view, updatedAt);
  const voted = view.me.vote !== null;
  const to = `/rodadas/${view.roundId}/votar`;
  return (
    <section
      aria-label="Votação aberta"
      className="moment-frame animate-moment-in flex flex-col bg-surface-raised"
      style={{ boxShadow: '5px 5px 0 var(--color-shadow)' }}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-3 bg-surface-3 px-4 py-4 shadow-[inset_0_-3px_0_0_var(--color-border-strong)]">
        <span className="flex min-w-0 items-center gap-3 text-text">
          <Icon name="urn" size={28} className="shrink-0" />
          <PixelText as="h2" size={24} wrap className="[text-shadow:2px_2px_0_#000]">
            Votação aberta
          </PixelText>
        </span>
        {remaining !== null && (
          <Badge variant="deadline" label={closesInLabel(remaining)} neutralIcon />
        )}
      </div>
      <div
        className="flex flex-col gap-4 p-4"
        style={{ '--moment-delay': '120ms' } as CSSProperties}
      >
        <div className="animate-row-in flex flex-col gap-4">
          <PixelText>{`Rodada ${view.number}`}</PixelText>
          <Meter voted={view.progress.voted} total={view.progress.total} />
          {!view.me.played ? (
            <p className="text-sm text-text-muted">
              Só quem jogou vota. O resultado sai quando fechar.
            </p>
          ) : voted ? (
            <span className="inline-flex items-center gap-2 text-text">
              <Icon name="check" size={18} strokeWidth={3} />
              <PixelText>Você já votou</PixelText>
            </span>
          ) : null}
        </div>
        {view.me.played && (
          <RouteButton
            to={to}
            label={voted ? 'Ver meus votos' : 'Dar minhas notas'}
            variant={voted || yieldKey ? 'outline' : 'primary'}
            size={voted || yieldKey ? 48 : 56}
            block
            className="animate-row-in [--moment-delay:220ms]"
          />
        )}
      </div>
    </section>
  );
}
