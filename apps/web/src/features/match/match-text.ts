import {
  MATCH_EVENT_TYPE_LABELS,
  type MatchEventItem,
  type MatchResult,
  type MatchScore,
} from '@fut-stats/shared';

type MatchEventType = MatchEventItem['type'];

type Team = 'WHITE' | 'BLACK';

/** "2 de 3 gols": quantos gols do time já têm autor, perto do placar dele. Sem placar, só a contagem. */
export function goalsOfScore(goals: number, scored: number | undefined): string {
  const noun = (scored ?? goals) === 1 ? 'gol' : 'gols';
  return scored === undefined ? `${goals} ${noun}` : `${goals} de ${scored} ${noun}`;
}

/** O quadro final do card de resultado, dito para leitor de tela: o placar começa pelo time de quem vê. */
export function resultAnnouncement(result: MatchResult, score: MatchScore, myTeam: Team): string {
  const other: Team = myTeam === 'WHITE' ? 'BLACK' : 'WHITE';
  const pair = `${score[myTeam]} a ${score[other]}`;
  if (result === 'WIN') return `Você venceu ${pair}`;
  if (result === 'LOSS') return `Você perdeu ${pair}`;
  return `Empate em ${pair}`;
}

/** Gol e gol contra são masculinos; assistência é feminina ("lançada", "apagada"). */
const FEMININE: Record<MatchEventType, boolean> = { GOAL: false, ASSIST: true, OWN_GOAL: false };

/** O particípio concordando com o lance: "lançado"/"lançada", "apagado"/"apagada". */
export function eventParticiple(type: MatchEventType, action: 'launched' | 'removed'): string {
  const feminine = FEMININE[type];
  if (action === 'launched') return feminine ? 'lançada' : 'lançado';
  return feminine ? 'apagada' : 'apagado';
}

/**
 * O título do aviso de lance, concordando com o gênero: "Gol de Diegão lançado", "Assistência de Diegão
 * apagada". Sem `nickname`, é o lance de quem lança: "Seu gol lançado", "Sua assistência apagada".
 */
export function eventNoticeTitle(
  type: MatchEventType,
  nickname: string | null,
  action: 'launched' | 'removed',
): string {
  const participle = eventParticiple(type, action);
  const label = MATCH_EVENT_TYPE_LABELS[type];
  if (nickname === null) {
    return `${FEMININE[type] ? 'Sua' : 'Seu'} ${label.toLowerCase()} ${participle}`;
  }
  return `${label} de ${nickname} ${participle}`;
}

/** "lançada por Carlão": quem lançou, na lista de lances do jogador, concordando com o lance. */
export function eventLaunchedBy(type: MatchEventType, createdByNickname: string): string {
  return `${eventParticiple(type, 'launched')} por ${createdByNickname}`;
}
