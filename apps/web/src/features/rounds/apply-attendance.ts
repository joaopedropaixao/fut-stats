import type { AttendanceMember, RoundDetail } from '@fut-stats/shared';

/**
 * A rodada como ficará depois de `membershipId` responder `confirmed` (atualização otimista).
 * Só espelha na tela o que a API vai devolver; quem manda é a resposta dela.
 */
export function applyAttendance(
  round: RoundDetail,
  membershipId: string,
  confirmed: boolean,
): RoundDetail {
  const { confirmed: going, declined, pending } = round.attendance;
  const member: AttendanceMember | undefined = [...going, ...declined, ...pending].find(
    (m) => m.membershipId === membershipId,
  );
  if (!member) return round;

  const without = (list: AttendanceMember[]) => list.filter((m) => m.membershipId !== membershipId);
  const withMember = (list: AttendanceMember[]) =>
    [...list, member].sort((a, b) => a.nickname.localeCompare(b.nickname, 'pt-BR'));

  const nextGoing = confirmed ? withMember(without(going)) : without(going);
  return {
    ...round,
    confirmedCount: nextGoing.length,
    myAttendance: membershipId === round.myMembershipId ? confirmed : round.myAttendance,
    attendance: {
      confirmed: nextGoing,
      declined: confirmed ? without(declined) : withMember(without(declined)),
      pending: without(pending),
    },
  };
}

/** A resposta atual de um membro: `true` = Vou, `false` = Não vou, `null` = ainda não respondeu. */
export function answerOf(round: RoundDetail, membershipId: string): boolean | null {
  if (round.attendance.confirmed.some((m) => m.membershipId === membershipId)) return true;
  if (round.attendance.declined.some((m) => m.membershipId === membershipId)) return false;
  return null;
}
