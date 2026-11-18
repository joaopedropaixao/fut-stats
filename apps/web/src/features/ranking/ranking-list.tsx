import { POSITION_LABELS, type Ranking, type RankingPlayer } from '@fut-stats/shared';
import { PixelText } from '../../components/ui/pixel-text';
import { RankingRow } from './ranking-row';
import {
  minimumText,
  rankingRows,
  RANKING_TAB_LABELS,
  type FieldPosition,
  type RankingTab,
} from './ranking-text';

type RankingListProps = {
  ranking: Ranking;
  tab: RankingTab;
  position: FieldPosition;
};

function Rows({
  players,
  tab,
  label,
  myId,
}: {
  players: RankingPlayer[];
  tab: RankingTab;
  label: string;
  myId: string;
}) {
  return (
    <ul aria-label={label} className="flex flex-col bg-surface shadow-card">
      {players.map((player, index) => (
        <RankingRow
          key={player.membershipId}
          player={player}
          tab={tab}
          index={index}
          mine={player.membershipId === myId}
        />
      ))}
    </ul>
  );
}

/**
 * A lista da aba escolhida: os classificados na ordem que a API mandou e, depois, "POUCOS JOGOS" (sem posição) com o
 * que falta para entrar. A API manda tudo numa resposta; a aba só escolhe quem mostrar.
 */
export function RankingList({ ranking, tab, position }: RankingListProps) {
  const { ranked, few } = rankingRows(ranking.players, tab, position);
  const myId = ranking.me.membershipId;
  const name = tab === 'posicao' ? POSITION_LABELS[position] : RANKING_TAB_LABELS[tab];

  if (ranked.length === 0 && few.length === 0) {
    return (
      <p className="px-1 text-sm text-text-muted">
        {tab === 'goleiros'
          ? 'Ninguém joga de Goleiro neste grupo ainda.'
          : `Ninguém joga de ${POSITION_LABELS[position]} neste grupo ainda.`}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {ranked.length > 0 && (
        <Rows players={ranked} tab={tab} label={`Ranking: ${name}`} myId={myId} />
      )}
      {few.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2>
            <PixelText>Poucos jogos</PixelText>
          </h2>
          <p className="px-1 text-sm text-text-muted">{minimumText(ranking.minRatedGames)}</p>
          <Rows players={few} tab={tab} label={`Poucos jogos: ${name}`} myId={myId} />
        </section>
      )}
    </div>
  );
}
