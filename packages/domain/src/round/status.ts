import { isValidRoundLineup, MAX_RESERVES_PER_TEAM, TEAMS } from '../core';
import {
  roundPlayerIds,
  tallyMatchEvents,
  validateScore,
  type RoundState,
  type RoundTeams,
} from './match';

/** Ciclo da rodada, na ordem. Textos em `packages/shared` (`ROUND_STATUS_LABELS`). */
export const ROUND_STATUSES = [
  'SCHEDULED',
  'TEAMS_PUBLISHED',
  'IN_PROGRESS',
  'POST_MATCH',
  'VOTING',
  'CLOSED',
] as const;

export type RoundStatus = (typeof ROUND_STATUSES)[number];

/**
 * Para onde cada status pode ir. O ciclo só anda para frente, com uma exceção: despublicar os
 * times (`TEAMS_PUBLISHED` → `SCHEDULED`) para refazê-los. Rodada encerrada não reabre.
 */
export const ROUND_TRANSITIONS: Readonly<Record<RoundStatus, readonly RoundStatus[]>> = {
  SCHEDULED: ['TEAMS_PUBLISHED'],
  TEAMS_PUBLISHED: ['SCHEDULED', 'IN_PROGRESS'],
  IN_PROGRESS: ['POST_MATCH'],
  POST_MATCH: ['VOTING'],
  VOTING: ['CLOSED'],
  CLOSED: [],
};

/** Por que a rodada não pode mudar de status. Textos em `packages/shared`. */
export const ROUND_TRANSITION_ERRORS = [
  'INVALID_TRANSITION',
  'INVALID_LINEUP',
  'INVALID_RESERVES',
  'SCORE_MISSING',
  'INVALID_SCORE',
  'GOALS_MISMATCH',
  'ATTENDANCE_MISMATCH',
] as const;

export type RoundTransitionError = (typeof ROUND_TRANSITION_ERRORS)[number];

export interface RoundTeamsOptions {
  /** Máximo de reservas por time. Padrão: `MAX_RESERVES_PER_TEAM` (2). */
  maxReservesPerTeam?: number;
}

/**
 * Confere os times da rodada: os dois 1-2-3-1 sem jogador nos dois (`INVALID_LINEUP`) e reservas
 * dentro do limite, sem repetir ninguém nem quem já é titular (`INVALID_RESERVES`).
 */
export function validateRoundTeams(
  teams: RoundTeams | null,
  { maxReservesPerTeam = MAX_RESERVES_PER_TEAM }: RoundTeamsOptions = {},
): RoundTransitionError[] {
  if (!teams) return ['INVALID_LINEUP'];

  const errors: RoundTransitionError[] = [];
  if (!isValidRoundLineup(teams)) errors.push('INVALID_LINEUP');

  const starters = new Set(TEAMS.flatMap((team) => teams[team].map((slot) => slot.playerId)));
  const reserves = TEAMS.flatMap((team) => teams.reserves[team]);
  if (
    TEAMS.some((team) => teams.reserves[team].length > maxReservesPerTeam) ||
    new Set(reserves).size !== reserves.length ||
    reserves.some((id) => starters.has(id))
  ) {
    errors.push('INVALID_RESERVES');
  }
  return errors;
}

/**
 * Quem confirmou presença jogou: os escalados (titulares e reservas) são exatamente os confirmados.
 * Sem times montados não há o que comparar (quem acusa é `validateRoundTeams`).
 */
export function validateAttendanceMatch(
  teams: RoundTeams | null,
  confirmedIds: readonly string[],
): RoundTransitionError[] {
  if (!teams) return [];
  const placed = new Set(roundPlayerIds(teams));
  const confirmed = new Set(confirmedIds);
  const same = placed.size === confirmed.size && [...placed].every((id) => confirmed.has(id));
  return same ? [] : ['ATTENDANCE_MISMATCH'];
}

/**
 * Times montados (sem eles não dá para contar os lances), placar lançado e válido e batendo com os
 * gols lançados: gols = placar, por time (assistência é solta).
 */
function validateScoreMatchesEvents(round: RoundState): RoundTransitionError[] {
  const { score, teams } = round;
  if (!teams) return ['INVALID_LINEUP'];
  if (!score) return ['SCORE_MISSING'];
  if (validateScore(score)) return ['INVALID_SCORE'];

  const tally = tallyMatchEvents(round.events, teams);
  const errors: RoundTransitionError[] = [];
  if (TEAMS.some((team) => tally.goals[team] !== score[team])) errors.push('GOALS_MISMATCH');
  return errors;
}

/**
 * Diz por que a rodada não pode ir de `round.status` para `to` (lista vazia = pode).
 * Pré-condições: publicar e começar o jogo exigem times válidos e confirmados = escalados; ir para a Resenha
 * (`POST_MATCH`) exige placar lançado e válido; ir para a votação e encerrar exigem placar batendo com os
 * gols lançados. O admin pode encerrar a votação a
 * qualquer momento: o prazo e o "todos votaram" só dizem quando fechar sozinha (`shouldCloseVoting`).
 */
export function validateRoundTransition(
  round: RoundState,
  to: RoundStatus,
  options: RoundTeamsOptions = {},
): RoundTransitionError[] {
  if (!ROUND_TRANSITIONS[round.status].includes(to)) return ['INVALID_TRANSITION'];

  switch (to) {
    case 'TEAMS_PUBLISHED':
    case 'IN_PROGRESS':
      return [
        ...validateRoundTeams(round.teams, options),
        ...validateAttendanceMatch(round.teams, round.confirmedIds),
      ];
    case 'POST_MATCH':
      // Finalizar o jogo exige o placar; os gols só precisam bater para abrir a votação.
      if (!round.score) return ['SCORE_MISSING'];
      return validateScore(round.score) ? ['INVALID_SCORE'] : [];
    case 'VOTING':
    case 'CLOSED':
      return validateScoreMatchesEvents(round);
    case 'SCHEDULED':
      return [];
  }
}

export function canTransitionRound(
  round: RoundState,
  to: RoundStatus,
  options: RoundTeamsOptions = {},
): boolean {
  return validateRoundTransition(round, to, options).length === 0;
}

/** Antes do jogo: agendada ou com os times publicados. */
function isBeforeMatch(status: RoundStatus): boolean {
  return status === 'SCHEDULED' || status === 'TEAMS_PUBLISHED';
}

/** Rodada só pode ser apagada antes do jogo (não há status de cancelada). */
export function isRoundDeletable(status: RoundStatus): boolean {
  return isBeforeMatch(status);
}

/** Data, hora e local só mudam antes do jogo; depois ficam como histórico. */
export function isRoundEditable(status: RoundStatus): boolean {
  return isBeforeMatch(status);
}
