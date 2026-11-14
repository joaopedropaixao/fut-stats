import type { TeamReserves } from '../balance-teams';
import { opponentOf, TEAMS, type RoundLineup, type Team } from '../core';
import type { RoundStatus } from './status';

/**
 * Tipos de lance (scout). `OWN_GOAL` = gol contra: fica com quem fez e conta para o adversário.
 * Gol sofrido não é lance: sai do placar.
 */
export const MATCH_EVENT_TYPES = ['GOAL', 'ASSIST', 'OWN_GOAL'] as const;

export type MatchEventType = (typeof MATCH_EVENT_TYPES)[number];

/** Um lance da rodada: quem fez e o tipo. Assistência é solta, não aponta para um gol. */
export interface MatchEvent {
  playerId: string;
  type: MatchEventType;
}

/** Placar da rodada: gols do Branco e do Preto. */
export type MatchScore = Readonly<Record<Team, number>>;

/** Times da rodada: titulares (1-2-3-1) e reservas. Quem está aqui jogou. */
export interface RoundTeams extends RoundLineup {
  readonly reserves: TeamReserves;
}

/** O que as regras precisam saber da rodada. `teams`/`score` nulos = ainda não montados/lançados. */
export interface RoundState {
  status: RoundStatus;
  teams: RoundTeams | null;
  /** Ids de quem confirmou presença (e segue ativo). Publicar e começar exigem que sejam os escalados. */
  confirmedIds: readonly string[];
  score: MatchScore | null;
  events: readonly MatchEvent[];
}

/** Gols (com gol contra a favor) e assistências lançados, por time. */
export interface MatchEventTally {
  goals: Record<Team, number>;
  assists: Record<Team, number>;
}

/** Resultado de um time no jogo, pelo placar. */
export const MATCH_RESULTS = ['WIN', 'LOSS', 'DRAW'] as const;

export type MatchResult = (typeof MATCH_RESULTS)[number];

export const SCORE_ERRORS = ['INVALID_SCORE'] as const;

export type ScoreError = (typeof SCORE_ERRORS)[number];

/** Ids de quem jogou: titulares e reservas dos dois times. */
export function roundPlayerIds(teams: RoundTeams): string[] {
  return TEAMS.flatMap((team) => [
    ...teams[team].map((slot) => slot.playerId),
    ...teams.reserves[team],
  ]);
}

/** Time em que o jogador jogou (titular ou reserva), ou null se não jogou. */
export function teamOf(playerId: string, teams: RoundTeams): Team | null {
  return (
    TEAMS.find(
      (team) =>
        teams[team].some((slot) => slot.playerId === playerId) ||
        teams.reserves[team].includes(playerId),
    ) ?? null
  );
}

/**
 * Soma os lances por time: gol conta para o time de quem fez, gol contra para o adversário,
 * assistência para o time de quem deu. Lance de quem não está nos times é ignorado.
 */
export function tallyMatchEvents(
  events: readonly MatchEvent[],
  teams: RoundTeams,
): MatchEventTally {
  const tally: MatchEventTally = { goals: { WHITE: 0, BLACK: 0 }, assists: { WHITE: 0, BLACK: 0 } };
  for (const event of events) {
    const team = teamOf(event.playerId, teams);
    if (!team) continue;
    if (event.type === 'GOAL') tally.goals[team] += 1;
    else if (event.type === 'OWN_GOAL') tally.goals[opponentOf(team)] += 1;
    else tally.assists[team] += 1;
  }
  return tally;
}

/** Placar válido = gols inteiros, zero ou mais, nos dois times. */
export function validateScore(score: MatchScore): ScoreError | null {
  const valid = TEAMS.every((team) => Number.isInteger(score[team]) && score[team] >= 0);
  return valid ? null : 'INVALID_SCORE';
}

/** Resultado do time no jogo, pelo placar: vitória, derrota ou empate. */
export function matchResult(score: MatchScore, team: Team): MatchResult {
  const diff = score[team] - score[opponentOf(team)];
  if (diff > 0) return 'WIN';
  return diff < 0 ? 'LOSS' : 'DRAW';
}
