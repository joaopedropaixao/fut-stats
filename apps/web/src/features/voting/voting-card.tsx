import { useQueryClient } from '@tanstack/react-query';
import { useEffect, type CSSProperties } from 'react';
import { AlertBand, AlertFrame, AlertTitle } from '../../components/ui/alert-frame';
import { ALERT_TONES } from '../../components/ui/alert-tone';
import { Badge } from '../../components/ui/badge';
import { Icon } from '../../components/ui/icons';
import { PixelText } from '../../components/ui/pixel-text';
import { alertsKey } from '../rounds/queries';
import { RouteButton } from '../rounds/route-button';
import { closesInLabel } from './deadline';
import { Meter } from './meter';
import { useVoting } from './queries';
import { votingKeyLabel } from './voting-key';
import { useCountdown } from './use-countdown';

type VotingCardProps = {
  groupId: string;
  roundId: string;
};

/**
 * Aviso grande da votação: grande momento prata (identidade `--color-silver` na moldura, na faixa listrada do cabeçalho e
 * no ícone da urna; contorno de 3px, sombra dura, entrada em degraus), com o tipo escrito ("VOTAÇÃO ABERTA"), a
 * rodada, o prazo, o medidor e **sempre a tecla amarela**, conforme o que a pessoa pode fazer: "Dar minhas notas"
 * (joguei e não votei), "Ver meus votos" (já votei) ou "Ver votação" (não joguei). O prata nunca vai na tecla.
 * Carrega sozinho; sem dado (carregando ou erro) o início segue sem o card.
 */
export function VotingCard({ groupId, roundId }: VotingCardProps) {
  const voting = useVoting(groupId, roundId);
  const view = voting.data;
  const closed = view?.status === 'CLOSED';
  const queryClient = useQueryClient();
  // Cinto de segurança: a votação fechou (prazo vencido) depois que os avisos chegaram; refaz os avisos para o
  // resultado tomar o lugar deste card, em vez de o topo do Feed ficar vazio.
  useEffect(() => {
    if (closed) void queryClient.invalidateQueries({ queryKey: alertsKey(groupId), exact: true });
  }, [closed, groupId, queryClient]);
  if (!view || view.status !== 'VOTING') return null;
  return <Loaded view={view} updatedAt={voting.dataUpdatedAt} />;
}

function Loaded({
  view,
  updatedAt,
}: {
  view: NonNullable<ReturnType<typeof useVoting>['data']>;
  updatedAt: number;
}) {
  const remaining = useCountdown(view, updatedAt);
  const voted = view.me.vote !== null;
  const to = `/rodadas/${view.roundId}/votar`;
  return (
    <AlertFrame tone="VOTING" label="Votação aberta">
      <AlertBand tone="VOTING" className="justify-between">
        <AlertTitle tone="VOTING" icon="urn">
          Votação aberta
        </AlertTitle>
        {remaining !== null && (
          <Badge variant="deadline" label={closesInLabel(remaining)} neutralIcon />
        )}
      </AlertBand>
      <div
        className="flex flex-col gap-4 p-4"
        style={{ '--moment-delay': '120ms' } as CSSProperties}
      >
        <div className="animate-row-in flex flex-col gap-4">
          <PixelText className={ALERT_TONES.VOTING.ink}>{`Rodada ${view.number}`}</PixelText>
          <Meter voted={view.progress.voted} total={view.progress.total} tone="silver" />
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
        <RouteButton
          to={to}
          label={votingKeyLabel(view.me.played, voted)}
          block
          className="animate-row-in [--moment-delay:220ms]"
        />
      </div>
    </AlertFrame>
  );
}
