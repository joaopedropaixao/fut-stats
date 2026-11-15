import { TEAM_LABELS, type ResultPlayer } from '@fut-stats/shared';
import { Badge } from '../../components/ui/badge';
import { ErrorState, SkeletonList } from '../../components/ui/states';
import { PixelText } from '../../components/ui/pixel-text';
import { MemberAvatar } from '../rounds/member-avatar';
import { RouteButton } from '../rounds/route-button';
import { useResult } from './queries';

/**
 * O bloco "Resultado" do detalhe da partida no Histórico (só em `CLOSED`): o Craque, o Perna de Pau e o caminho
 * para as notas. Sem votos, uma frase só.
 */
export function ResultBlock({ groupId, roundId }: { groupId: string; roundId: string }) {
  const result = useResult(groupId, roundId);
  const data = result.data;
  return (
    <section aria-label="Resultado da votação" className="flex flex-col gap-3">
      <PixelText as="h2" size={24}>
        Resultado
      </PixelText>
      {result.isError && !data ? (
        <ErrorState
          title="Não deu para abrir o resultado"
          message="Confira a internet e tente de novo."
          onRetry={() => void result.refetch()}
          retrying={result.isFetching}
        />
      ) : !data ? (
        <SkeletonList rows={2} label="Carregando o resultado" />
      ) : (
        <div className="moment-frame animate-moment-in flex flex-col bg-surface-raised">
          {data.votes.voted === 0 ? (
            <p className="p-4 text-base text-text-muted">
              Ninguém votou nesta rodada. Sem notas e sem prêmios.
            </p>
          ) : (
            <>
              {data.mvps.map((p) => (
                <Row key={p.membershipId} player={p} kind="craque" />
              ))}
              {data.flops.map((p) => (
                <Row key={p.membershipId} player={p} kind="flop" />
              ))}
            </>
          )}
          <div className="p-4 shadow-[inset_0_3px_0_0_var(--color-border-strong)]">
            <RouteButton
              to={`/rodadas/${roundId}/resultado`}
              label="Ver notas"
              variant="outline"
              size={48}
              block
            />
          </div>
        </div>
      )}
    </section>
  );
}

function Row({ player, kind }: { player: ResultPlayer; kind: 'craque' | 'flop' }) {
  return (
    <div className="flex min-h-16 items-center gap-3 px-4 py-2 first:shadow-none shadow-[inset_0_2px_0_0_var(--color-border)]">
      <MemberAvatar nickname={player.nickname} avatar={player.avatar} size={40} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Badge
          variant={kind}
          label={kind === 'craque' ? 'Craque' : 'Perna de pau'}
          className="self-start"
        />
        <PixelText wrap className={kind === 'craque' ? 'text-gold' : 'text-flop'}>
          {player.nickname}
        </PixelText>
      </div>
      <PixelText className="text-text-muted">{TEAM_LABELS[player.team]}</PixelText>
    </div>
  );
}
