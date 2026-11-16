import type { FeedAlert, PlayerAvatar } from '@fut-stats/shared';
import { ErrorState, SkeletonList } from '../../components/ui/states';
import { PixelText } from '../../components/ui/pixel-text';
import { formatRoundWhen } from '../../lib/round-format';
import { GameCard } from '../match/game-card';
import { useMatch } from '../match/queries';
import { PresenceCard } from '../rounds/presence-card';
import { useRound } from '../rounds/queries';
import { ResultAlert } from '../voting/result-alert';
import { VotingCard } from '../voting/voting-card';
import { TeamsPublishedCard } from './teams-published-card';

type AlertCardProps = {
  groupId: string;
  alert: FeedAlert;
  /** Quem vê: o bonequinho e o id da participação (a faixa "Você joga no ..."). */
  me: { membershipId: string; avatar: PlayerAvatar };
};

/**
 * O aviso grande, o único card da pilha: escolhe o card pelo tipo e reaproveita os que já existiam (resultado,
 * votação, jogo, presença); só o dos times é novo. Cada um é um grande momento (contorno grosso, sombra dura,
 * entrada em degraus) e só ele tem a tecla amarela da tela.
 */
export function AlertCard({ groupId, alert, me }: AlertCardProps) {
  switch (alert.type) {
    case 'RESULT':
      return <ResultAlert groupId={groupId} roundId={alert.roundId} number={alert.roundNumber} />;
    case 'VOTING':
      return <VotingCard groupId={groupId} roundId={alert.roundId} />;
    case 'TEAMS_PUBLISHED':
      return <TeamsPublishedCard groupId={groupId} alert={alert} me={me} />;
    case 'PRESENCE':
      return <PresenceAlert groupId={groupId} alert={alert} />;
    case 'IN_PROGRESS':
    case 'POST_MATCH':
      return <GameAlert groupId={groupId} alert={alert} />;
  }
}

function PresenceAlert({ groupId, alert }: { groupId: string; alert: FeedAlert }) {
  const round = useRound(groupId, alert.roundId);
  if (round.isError)
    return (
      <ErrorState
        title="Não deu para abrir a presença"
        message="Confira a internet e tente de novo."
        onRetry={() => void round.refetch()}
        retrying={round.isFetching}
      />
    );
  if (!round.data) return <SkeletonList rows={3} label="Carregando a presença" />;
  return <PresenceCard groupId={groupId} round={round.data} />;
}

/** Rodada em jogo ou na Resenha: o card do jogo, com o número e o dia da rodada acima dele. */
function GameAlert({ groupId, alert }: { groupId: string; alert: FeedAlert }) {
  const match = useMatch(groupId, alert.roundId);
  if (match.isError)
    return (
      <ErrorState
        title="Não deu para abrir o jogo"
        message="Confira a internet e tente de novo."
        onRetry={() => void match.refetch()}
        retrying={match.isFetching}
      />
    );
  if (!match.data) return <SkeletonList rows={3} label="Carregando o jogo" />;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <PixelText>{`Rodada ${match.data.number}`}</PixelText>
        <PixelText wrap className="text-text-muted">
          {formatRoundWhen(match.data.scheduledAt)}
        </PixelText>
      </div>
      <GameCard view={match.data} />
    </div>
  );
}
