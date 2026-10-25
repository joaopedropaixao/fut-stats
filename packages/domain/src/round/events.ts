import { opponentOf } from '../core';
import {
  tallyMatchEvents,
  teamOf,
  validateScore,
  type MatchEvent,
  type MatchScore,
  type RoundState,
} from './match';
import type { RoundStatus } from './status';

/** Quem está agindo na rodada: o id do jogador e se ele é admin do grupo. */
export interface RoundActor {
  id: string;
  isAdmin: boolean;
}

/** Por que um lance não pode ser lançado ou apagado. Textos em `packages/shared`. */
export const MATCH_EVENT_ERRORS = [
  'ROUND_NOT_OPEN',
  'NOT_OWN_EVENT',
  'PLAYER_DID_NOT_PLAY',
  'GOALS_EXCEED_SCORE',
] as const;

export type MatchEventError = (typeof MATCH_EVENT_ERRORS)[number];

/** Por que o placar não pode ser lançado. Textos em `packages/shared`. */
export const SCORE_ENTRY_ERRORS = ['ROUND_NOT_OPEN', 'NOT_ADMIN', 'INVALID_SCORE'] as const;

export type ScoreEntryError = (typeof SCORE_ENTRY_ERRORS)[number];

/** Scouts e placar só se lançam e corrigem em jogo ou na Resenha pós-jogo; abriu a votação, congela. */
export function isMatchOpen(status: RoundStatus): boolean {
  return status === 'IN_PROGRESS' || status === 'POST_MATCH';
}

/**
 * Diz por que o lance não pode ser lançado (lista vazia = pode). Durante o jogo (`IN_PROGRESS`) só o
 * admin lança (`ADMIN_ONLY_IN_MATCH` para os demais); na Resenha, jogador lança só os próprios;
 * admin, de qualquer um; quem fez o lance tem que ter jogado (titular ou reserva). Com placar
 * lançado, os gols de um time não passam do placar dele, nem as assistências.
 * Fora de `IN_PROGRESS`/`POST_MATCH`, devolve só `ROUND_NOT_OPEN`.
 */
export function validateMatchEvent(
  event: MatchEvent,
  actor: RoundActor,
  round: RoundState,
): MatchEventError[] {
  if (!isMatchOpen(round.status)) return ['ROUND_NOT_OPEN'];
  if (round.status === 'IN_PROGRESS') return ['ROUND_NOT_OPEN'];

  const errors: MatchEventError[] = [];
  if (!actor.isAdmin && actor.id !== event.playerId) errors.push('NOT_OWN_EVENT');

  const team = round.teams ? teamOf(event.playerId, round.teams) : null;
  if (!round.teams || !team) return [...errors, 'PLAYER_DID_NOT_PLAY'];

  if (round.score) {
    const tally = tallyMatchEvents(round.events, round.teams);
    if (event.type !== 'ASSIST') {
      const scoringTeam = event.type === 'GOAL' ? team : opponentOf(team);
      if (tally.goals[scoringTeam] + 1 > round.score[scoringTeam]) {
        errors.push('GOALS_EXCEED_SCORE');
      }
    }
  }
  return errors;
}

export function canLaunchMatchEvent(
  event: MatchEvent,
  actor: RoundActor,
  round: RoundState,
): boolean {
  return validateMatchEvent(event, actor, round).length === 0;
}

/**
 * Diz por que o lance não pode ser apagado (lista vazia = pode). Mesma janela e mesma regra de
 * dono do lançamento. Corrigir = apagar + lançar. Pode deixar os gols abaixo do placar: quem
 * barra é a transição (`validateRoundTransition`), que exige placar batendo para encerrar.
 */
export function validateMatchEventRemoval(
  event: MatchEvent,
  actor: RoundActor,
  round: RoundState,
): MatchEventError[] {
  if (!isMatchOpen(round.status)) return ['ROUND_NOT_OPEN'];
  if (round.status === 'IN_PROGRESS') return ['ROUND_NOT_OPEN'];
  return !actor.isAdmin && actor.id !== event.playerId ? ['NOT_OWN_EVENT'] : [];
}

/**
 * Diz por que o placar não pode ser lançado ou corrigido (lista vazia = pode). Só admin, com o
 * jogo em andamento ou na Resenha; o placar não pode ficar abaixo dos gols nem das assistências
 * já lançados de cada time. Fora de `IN_PROGRESS`/`POST_MATCH`, devolve só `ROUND_NOT_OPEN`.
 */
export function validateScoreEntry(
  score: MatchScore,
  actor: RoundActor,
  round: RoundState,
): ScoreEntryError[] {
  if (!isMatchOpen(round.status)) return ['ROUND_NOT_OPEN'];

  const errors: ScoreEntryError[] = [];
  if (!actor.isAdmin) errors.push('NOT_ADMIN');
  if (validateScore(score)) return [...errors, 'INVALID_SCORE'];
  return errors;
}
