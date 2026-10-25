import type { RoundStatus } from './status';

/** O mínimo de uma rodada para saber se ela é a atual. */
export interface RoundAtTime {
  status: RoundStatus;
  scheduledAt: Date;
}

export interface CurrentRoundOptions {
  /**
   * Por quantas horas depois do horário marcado uma rodada ainda não começada continua sendo a atual
   * (o admin esqueceu de começar o jogo). Depois disso, é ignorada. Padrão: 24.
   */
  staleAfterHours?: number;
}

const DEFAULT_STALE_AFTER_HOURS = 24;
const HOUR_MS = 60 * 60 * 1000;

/**
 * A rodada que o app mostra como "a da vez" (início e aba Times): a que está em jogo ou na Resenha pós-jogo, se houver
 * (a de horário mais recente); senão, a de antes do jogo com o horário mais cedo, contando as que
 * passaram do horário há menos de `staleAfterHours`. Votação e encerrada não contam. `now` vem de
 * fora (o domínio não lê relógio).
 */
export function pickCurrentRound<T extends RoundAtTime>(
  rounds: readonly T[],
  now: Date,
  options: CurrentRoundOptions = {},
): T | null {
  const inProgress = rounds
    .filter((round) => round.status === 'IN_PROGRESS' || round.status === 'POST_MATCH')
    .sort((a, b) => b.scheduledAt.getTime() - a.scheduledAt.getTime());
  if (inProgress[0]) return inProgress[0];

  const staleAfterHours = options.staleAfterHours ?? DEFAULT_STALE_AFTER_HOURS;
  const cutoff = now.getTime() - staleAfterHours * HOUR_MS;
  const upcoming = rounds
    .filter(
      (round) =>
        (round.status === 'SCHEDULED' || round.status === 'TEAMS_PUBLISHED') &&
        round.scheduledAt.getTime() >= cutoff,
    )
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  return upcoming[0] ?? null;
}
