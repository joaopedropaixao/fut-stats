import type { MatchView } from '@fut-stats/shared';

import { SAFETY_REFRESH_MS, type ChannelMode } from '../live/stream-state';

type RoundStatus = MatchView['status'];

/** De quanto em quanto tempo o jogo se atualiza sozinho em jogo (ms). */
export const IN_PROGRESS_REFRESH_MS = 15_000;

/** Na Resenha vários jogadores lançam ao mesmo tempo: o intervalo é menor para os lances dos outros aparecerem logo. */
export const POST_MATCH_REFRESH_MS = 5_000;

/**
 * O intervalo de atualização do jogo por status. `false` = sem polling (nos outros status nada muda sozinho).
 * Com o canal ao vivo conectado, é só a rede de segurança (60 s); no modo antigo, os tempos de sempre.
 */
export function matchRefreshInterval(
  status: RoundStatus | undefined,
  channel: ChannelMode = 'polling',
): number | false {
  if (status === 'POST_MATCH')
    return channel === 'live' ? SAFETY_REFRESH_MS : POST_MATCH_REFRESH_MS;
  if (status === 'IN_PROGRESS')
    return channel === 'live' ? SAFETY_REFRESH_MS : IN_PROGRESS_REFRESH_MS;
  return false;
}
