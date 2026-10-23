import type { RoundActor } from './events';
import { isRoundEditable, type RoundStatus } from './status';

/** Por que a presença (Vou / Não vou) não pode ser marcada. Textos em `packages/shared`. */
export const ATTENDANCE_ERRORS = [
  'ATTENDANCE_CLOSED',
  'NOT_OWN_ATTENDANCE',
  'TEAMS_ALREADY_PUBLISHED',
] as const;

export type AttendanceError = (typeof ATTENDANCE_ERRORS)[number];

/**
 * Diz por que `actor` não pode marcar a presença de `playerId` (lista vazia = pode). Jogador marca
 * só a própria, e só com a rodada agendada; com os times publicados, só o admin muda, de qualquer
 * um. Do jogo em diante (`IN_PROGRESS`+), trava para todos e devolve só `ATTENDANCE_CLOSED`.
 * Sem limite de confirmados: acima do que o seletor aceita, o admin ajusta a lista.
 */
export function validateAttendanceChange(
  playerId: string,
  actor: RoundActor,
  status: RoundStatus,
): AttendanceError[] {
  if (!isRoundEditable(status)) return ['ATTENDANCE_CLOSED'];
  if (actor.isAdmin) return [];

  const errors: AttendanceError[] = [];
  if (actor.id !== playerId) errors.push('NOT_OWN_ATTENDANCE');
  if (status === 'TEAMS_PUBLISHED') errors.push('TEAMS_ALREADY_PUBLISHED');
  return errors;
}

export function canChangeAttendance(
  playerId: string,
  actor: RoundActor,
  status: RoundStatus,
): boolean {
  return validateAttendanceChange(playerId, actor, status).length === 0;
}
