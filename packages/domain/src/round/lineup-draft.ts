import { FORMATION, MAX_RESERVES_PER_TEAM, POSITIONS, TEAMS } from '../core';
import type { RoundTeamsOptions } from './status';
import type { RoundTeams } from './match';

/** Por que o rascunho dos times não pode ser salvo. Textos em `packages/shared`. */
export const LINEUP_DRAFT_ERRORS = [
  'DUPLICATE_PLAYER',
  'POSITION_FULL',
  'TOO_MANY_RESERVES',
] as const;

export type LineupDraftError = (typeof LINEUP_DRAFT_ERRORS)[number];

/**
 * Confere um rascunho dos times (pode estar incompleto): ninguém repetido (nem nos dois times, nem
 * titular e reserva), nenhuma posição com mais gente que o 1-2-3-1 e reservas dentro do limite.
 * Completar o 1-2-3-1 só é exigido para publicar (`validateRoundTeams`).
 */
export function validateLineupDraft(
  draft: RoundTeams,
  { maxReservesPerTeam = MAX_RESERVES_PER_TEAM }: RoundTeamsOptions = {},
): LineupDraftError[] {
  const ids = TEAMS.flatMap((team) => [
    ...draft[team].map((slot) => slot.playerId),
    ...draft.reserves[team],
  ]);
  const errors: LineupDraftError[] = [];
  if (new Set(ids).size !== ids.length) errors.push('DUPLICATE_PLAYER');
  if (
    TEAMS.some((team) =>
      POSITIONS.some(
        (position) =>
          draft[team].filter((slot) => slot.position === position).length > FORMATION[position],
      ),
    )
  ) {
    errors.push('POSITION_FULL');
  }
  if (TEAMS.some((team) => draft.reserves[team].length > maxReservesPerTeam)) {
    errors.push('TOO_MANY_RESERVES');
  }
  return errors;
}
