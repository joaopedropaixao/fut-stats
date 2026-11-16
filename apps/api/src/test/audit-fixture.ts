import type { Position, RoundStatus, Team } from '../generated/prisma/enums';
import { addMember, createGroup, createUser, loginAs } from './auth';
import type { TestApp } from './test-app';

/** 1-2-3-1: goleiro, 2 zagueiros, 2 alas, 1 meio, 1 atacante. */
const FORMATION: Position[] = [
  'GOALKEEPER',
  'DEFENDER',
  'DEFENDER',
  'WINGER',
  'WINGER',
  'MIDFIELDER',
  'FORWARD',
];

export interface Person {
  userId: string;
  membershipId: string;
  cookie: string;
}

const HOUR_MS = 60 * 60 * 1000;

/**
 * Grupo para os testes do registro da rodada: um admin (que não joga), 14 escalados (7 por time, todos
 * confirmados, a rodada no `status` pedido), um jogador de fora e um membro inativo.
 * Com `VOTING`, a votação abriu há `votingOpenedAgoMs`.
 */
export async function setupAuditGroup(
  t: TestApp,
  opts: {
    status?: RoundStatus;
    score?: { WHITE: number; BLACK: number };
    votingOpenedAgoMs?: number;
  } = {},
) {
  const { status = 'SCHEDULED', score, votingOpenedAgoMs = HOUR_MS } = opts;
  const group = await createGroup(t);
  const adminUser = await createUser(t);
  const adminMember = await addMember(t, adminUser.id, group.id, {
    role: 'ADMIN',
    nickname: 'Chefe',
  });
  const admin: Person = {
    userId: adminUser.id,
    membershipId: adminMember.id,
    cookie: loginAs(t, adminUser.id),
  };

  const round = await t.prisma.round.create({
    data: {
      groupId: group.id,
      scheduledAt: new Date(Date.now() - 2 * HOUR_MS),
      status,
      // Fechar a votação exige placar: em `VOTING` o padrão é 0x0.
      whiteGoals: score?.WHITE ?? (status === 'VOTING' ? 0 : null),
      blackGoals: score?.BLACK ?? (status === 'VOTING' ? 0 : null),
      votingOpenedAt: status === 'VOTING' ? new Date(Date.now() - votingOpenedAgoMs) : null,
    },
  });

  const white: Person[] = [];
  const black: Person[] = [];
  for (const [team, list] of [
    ['WHITE', white],
    ['BLACK', black],
  ] as const satisfies readonly (readonly [Team, Person[]])[]) {
    for (const [i, position] of FORMATION.entries()) {
      const user = await createUser(t);
      const member = await addMember(t, user.id, group.id, {
        nickname: `${team === 'WHITE' ? 'B' : 'P'}${i}`,
        primaryPosition: position,
      });
      await t.prisma.teamPlayer.create({
        data: { roundId: round.id, membershipId: member.id, team, position },
      });
      await t.prisma.attendance.create({
        data: { roundId: round.id, membershipId: member.id, confirmed: true },
      });
      list.push({ userId: user.id, membershipId: member.id, cookie: loginAs(t, user.id) });
    }
  }

  const benchUser = await createUser(t);
  const benchMember = await addMember(t, benchUser.id, group.id, { nickname: 'Banco' });
  const bench: Person = {
    userId: benchUser.id,
    membershipId: benchMember.id,
    cookie: loginAs(t, benchUser.id),
  };
  const inactiveUser = await createUser(t);
  await addMember(t, inactiveUser.id, group.id, { active: false });
  const inactive = { userId: inactiveUser.id, cookie: loginAs(t, inactiveUser.id) };

  return { group, round, admin, white, black, bench, inactive };
}

export type AuditGroup = Awaited<ReturnType<typeof setupAuditGroup>>;

/** Um usuário de fora, em outro grupo (admin dele), com uma rodada própria. */
export async function setupOutsider(t: TestApp) {
  const group = await createGroup(t);
  const user = await createUser(t);
  const member = await addMember(t, user.id, group.id, { role: 'ADMIN' });
  const round = await t.prisma.round.create({
    data: { groupId: group.id, scheduledAt: new Date(), status: 'SCHEDULED' },
  });
  return { group, round, user, member, cookie: loginAs(t, user.id) };
}
