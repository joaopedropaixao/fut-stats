import type { GoalkeeperStats, PlayerRound, RankingPlayer, Streak } from '@fut-stats/shared';

/** As posições do seletor da aba "Posição" (o goleiro tem aba própria). */
export const FIELD_POSITIONS = ['DEFENDER', 'WINGER', 'MIDFIELDER', 'FORWARD'] as const;
export type FieldPosition = (typeof FIELD_POSITIONS)[number];

export const RANKING_TABS = ['geral', 'posicao', 'goleiros'] as const;
export type RankingTab = (typeof RANKING_TABS)[number];

export const RANKING_TAB_LABELS: Record<RankingTab, string> = {
  geral: 'Geral',
  posicao: 'Posição',
  goleiros: 'Goleiros',
};

/** A média com uma casa, meio para cima, a partir do número da API (que já vem com 2 casas): 8.45 → 8.5. */
export function roundAverage(value: number): number {
  return Math.round(Math.round(value * 100) / 10) / 10;
}

/** Uma casa com vírgula, como a média aparece na tela: 8.45 → "8,5". */
export function formatAverage(value: number): string {
  return roundAverage(value).toFixed(1).replace('.', ',');
}

/** "12 jogos" / "1 jogo". */
export function gamesText(games: number): string {
  return `${games} ${games === 1 ? 'jogo' : 'jogos'}`;
}

/** "subiu 2 posições", "desceu 1 posição", "manteve a posição": o nome da tendência para leitor de tela. */
export function trendLabel(trend: number): string {
  if (trend === 0) return 'manteve a posição';
  const n = Math.abs(trend);
  return `${trend > 0 ? 'subiu' : 'desceu'} ${n} ${n === 1 ? 'posição' : 'posições'}`;
}

/** "Precisa de 3 rodadas com nota para entrar no ranking". */
export function minimumText(minRatedGames: number): string {
  const unit = minRatedGames === 1 ? 'rodada' : 'rodadas';
  return `Precisa de ${minRatedGames} ${unit} com nota para entrar no ranking`;
}

/** Quantas rodadas com nota ainda faltam (nunca negativo). */
export function missingRounds(minRatedGames: number, ratedGames: number): number {
  return Math.max(minRatedGames - ratedGames, 0);
}

/** "FALTAM 2 RODADAS PARA VOCÊ ENTRAR NO RANKING" / "FALTA 1 RODADA ...". */
export function missingRoundsText(missing: number): string {
  return missing === 1
    ? 'Falta 1 rodada para você entrar no ranking'
    : `Faltam ${missing} rodadas para você entrar no ranking`;
}

const STREAK_TEXT: Record<Streak['result'], { one: string; many: string; mark: '▲' | '▼' | '=' }> =
  {
    WIN: { one: 'vitória seguida', many: 'vitórias seguidas', mark: '▲' },
    LOSS: { one: 'derrota seguida', many: 'derrotas seguidas', mark: '▼' },
    DRAW: { one: 'empate seguido', many: 'empates seguidos', mark: '=' },
  };

/** "3 vitórias seguidas": só aparece a partir de 2 resultados iguais seguidos. */
export function streakView(streak: Streak | null): { mark: '▲' | '▼' | '='; text: string } | null {
  if (!streak || streak.count < 2) return null;
  const { many, mark } = STREAK_TEXT[streak.result];
  return { mark, text: `${streak.count} ${many}` };
}

/** As duas linhas do goleiro: o número (vira dígito pixel) e o resto da frase, que pode quebrar em tela estreita. */
export function goalkeeperLines(
  goalkeeper: GoalkeeperStats | null,
): { value: string | null; label: string }[] {
  if (!goalkeeper || goalkeeper.games === 0 || goalkeeper.concededPerGame === null) {
    return [{ value: null, label: 'Ainda sem jogo no gol' }];
  }
  const clean = goalkeeper.cleanSheets;
  return [
    { value: formatAverage(goalkeeper.concededPerGame), label: 'gols sofridos por jogo' },
    { value: String(clean), label: `${clean === 1 ? 'jogo' : 'jogos'} sem sofrer gol` },
  ];
}

/** "2 gols · 1 assistência · 1 gol contra"; sem nada, "Sem gols nem assistências". */
export function roundLancesText(round: Pick<PlayerRound, 'goals' | 'assists'>): string {
  const parts: string[] = [];
  if (round.goals > 0) parts.push(`${round.goals} ${round.goals === 1 ? 'gol' : 'gols'}`);
  if (round.assists > 0) {
    parts.push(`${round.assists} ${round.assists === 1 ? 'assistência' : 'assistências'}`);
  }
  return parts.length > 0 ? parts.join(' · ') : 'Sem gols nem assistências';
}

/** O resultado de uma rodada por extenso, para leitor de tela. */
export const RESULT_WORD: Record<PlayerRound['result'], string> = {
  WIN: 'Vitória',
  DRAW: 'Empate',
  LOSS: 'Derrota',
};

/** A aba e a posição escolhidas na URL; valor inválido ou ausente cai no padrão. */
export function parseRankingView(
  params: URLSearchParams,
  myPosition: RankingPlayer['primaryPosition'] | undefined,
): { tab: RankingTab; position: FieldPosition } {
  const tab = RANKING_TABS.find((t) => t === params.get('aba')) ?? 'geral';
  const asked = FIELD_POSITIONS.find((p) => p === params.get('posicao'));
  // Abre na minha posição; o goleiro (que não está na lista) abre em Zagueiro
  const mine = FIELD_POSITIONS.find((p) => p === myPosition);
  return { tab, position: asked ?? mine ?? 'DEFENDER' };
}

/** A URL (só a parte da busca) de uma aba; a de posição leva a posição escolhida. */
export function rankingSearch(tab: RankingTab, position: FieldPosition): string {
  if (tab === 'geral') return '';
  return tab === 'posicao' ? `?aba=posicao&posicao=${position}` : '?aba=goleiros';
}

/** O que cada aba mostra, na ordem que a API mandou: classificados (com a posição da aba) e depois os de poucos jogos. */
export function rankingRows(
  players: readonly RankingPlayer[],
  tab: RankingTab,
  position: FieldPosition,
): { ranked: RankingPlayer[]; few: RankingPlayer[] } {
  const inTab =
    tab === 'geral'
      ? players
      : players.filter((p) => p.primaryPosition === (tab === 'goleiros' ? 'GOALKEEPER' : position));
  return {
    ranked: inTab.filter((p) => shownRank(p, tab) !== null),
    few: inTab.filter((p) => shownRank(p, tab) === null),
  };
}

/** A posição que a aba mostra: a geral na aba Geral, a de dentro da posição nas outras. */
export function shownRank(player: RankingPlayer, tab: RankingTab): number | null {
  return tab === 'geral' ? player.rank : player.positionRank;
}

/** A palavra comprida ganha um ponto de quebra (hífen suave): "Assistências" não é cortada na célula estreita. */
export function breakable(label: string): string {
  return label.replace(/assis(tências)/i, (_all, rest: string) => `Assis\u00AD${rest}`);
}
