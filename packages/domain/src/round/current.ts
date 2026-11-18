import { RESULT_HIGHLIGHT_DAYS } from './voting';
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
const DAY_MS = 24 * HOUR_MS;

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

/**
 * A rodada com a votação aberta (`VOTING`) que o início mostra: a de data marcada mais recente.
 * Sem nenhuma, `null`. Fechou por prazo ou pelo admin, deixa de ser essa (vira o resultado).
 */
export function pickVotingRound<T extends RoundAtTime>(rounds: readonly T[]): T | null {
  return (
    rounds
      .filter((round) => round.status === 'VOTING')
      .sort((a, b) => b.scheduledAt.getTime() - a.scheduledAt.getTime())[0] ?? null
  );
}

/** O mínimo de uma rodada para saber se o resultado dela ainda está em destaque. */
export interface RoundClosedAt {
  status: RoundStatus;
  closedAt: Date | null;
}

export interface LatestResultOptions {
  /** Por quantos dias o resultado fica em destaque depois de fechar. Padrão: `RESULT_HIGHLIGHT_DAYS` (7). */
  highlightDays?: number;
}

/**
 * O resultado que o início destaca ("O resultado saiu"): a rodada `CLOSED` que fechou por último, desde que
 * tenha fechado há menos de `highlightDays` dias (com exatamente 7 dias, já saiu do destaque). Sem nenhuma, `null`.
 * `now` vem de fora (o domínio não lê relógio).
 */
export function pickLatestResult<T extends RoundClosedAt>(
  rounds: readonly T[],
  now: Date,
  { highlightDays = RESULT_HIGHLIGHT_DAYS }: LatestResultOptions = {},
): T | null {
  const oldest = now.getTime() - highlightDays * DAY_MS;
  const closed = rounds
    .filter(
      (round): round is T & { closedAt: Date } =>
        round.status === 'CLOSED' && round.closedAt !== null && round.closedAt.getTime() > oldest,
    )
    .sort((a, b) => b.closedAt.getTime() - a.closedAt.getTime());
  return closed[0] ?? null;
}
