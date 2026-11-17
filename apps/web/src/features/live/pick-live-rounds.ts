import { LIVE_ROUND_STATUSES, type RoundList } from '@fut-stats/shared';

/** No máximo duas conexões: a rodada da vez e a rodada em votação. */
export const MAX_LIVE_ROUNDS = 2;

const LIVE = new Set<string>(LIVE_ROUND_STATUSES);

/**
 * As rodadas que merecem canal aberto: a da vez e a em votação (sem repetir), só se estiverem numa etapa de
 * `LIVE_ROUND_STATUSES`. A da vez agendada abre (é por onde os times publicados chegam); encerrada ou
 * inexistente não abre conexão.
 */
export function pickLiveRoundIds(list: RoundList | undefined): string[] {
  if (!list) return [];
  const byId = new Map([...list.upcoming, ...list.past].map((round) => [round.id, round]));
  const wanted = [list.currentId, list.votingId];
  const ids: string[] = [];
  for (const id of wanted) {
    if (id === null || ids.includes(id)) continue;
    const round = byId.get(id);
    if (round && LIVE.has(round.status)) ids.push(id);
  }
  return ids.slice(0, MAX_LIVE_ROUNDS);
}
