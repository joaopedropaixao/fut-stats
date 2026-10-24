import type { AttendanceMember, RoundDetail } from '@fut-stats/shared';
import { describe, expect, it } from 'vitest';
import { answerOf, applyAttendance } from './apply-attendance';

const member = (id: string, nickname: string): AttendanceMember => ({
  membershipId: id,
  nickname,
  photoUrl: null,
  primaryPosition: 'MIDFIELDER',
  isHiredGoalkeeper: false,
  respondedAt: null,
  rating: 6,
  rank: 1,
});

const round: RoundDetail = {
  id: 'r1',
  number: 3,
  scheduledAt: '2026-10-29T23:00:00.000Z',
  location: 'Arena',
  status: 'SCHEDULED',
  confirmedCount: 1,
  myMembershipId: 'm-me',
  myAttendance: null,
  permissions: { setOwnAttendance: true, setAnyAttendance: false, edit: false, delete: false },
  attendance: {
    confirmed: [member('m-zeca', 'Zeca')],
    declined: [member('m-bia', 'Bia')],
    pending: [member('m-me', 'Eu'), member('m-ana', 'Ana')],
  },
};

describe('applyAttendance', () => {
  it('quem não tinha respondido entra no fim dos confirmados (ordem de chegada), com o horário, e conta', () => {
    const now = new Date('2026-10-24T15:00:00.000Z');
    const next = applyAttendance(round, 'm-ana', true, now);

    expect(next.attendance.confirmed.map((m) => m.nickname)).toEqual(['Zeca', 'Ana']);
    expect(next.attendance.confirmed[1]!.respondedAt).toBe(now.toISOString());
    expect(next.attendance.pending.map((m) => m.nickname)).toEqual(['Eu']);
    expect(next.confirmedCount).toBe(2);
    expect(next.myAttendance).toBeNull();
  });

  it('a própria resposta atualiza myAttendance', () => {
    expect(applyAttendance(round, 'm-me', false).myAttendance).toBe(false);
    expect(applyAttendance(round, 'm-me', true).myAttendance).toBe(true);
  });

  it('muda de lado: confirmado que desiste vai para não vão e sai da contagem', () => {
    const next = applyAttendance(round, 'm-zeca', false);

    expect(next.attendance.confirmed).toEqual([]);
    expect(next.attendance.declined.map((m) => m.nickname)).toEqual(['Bia', 'Zeca']);
    expect(next.confirmedCount).toBe(0);
  });

  it('repetir a mesma resposta não duplica ninguém', () => {
    const next = applyAttendance(round, 'm-zeca', true);

    expect(next.attendance.confirmed).toHaveLength(1);
    expect(next.confirmedCount).toBe(1);
  });

  it('membro que não está na lista deixa tudo como está', () => {
    expect(applyAttendance(round, 'm-fora', true)).toBe(round);
  });
});

describe('answerOf', () => {
  it('diz Vou, Não vou ou sem resposta', () => {
    expect(answerOf(round, 'm-zeca')).toBe(true);
    expect(answerOf(round, 'm-bia')).toBe(false);
    expect(answerOf(round, 'm-ana')).toBeNull();
  });
});
