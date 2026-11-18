import type { PlayerAvatar } from '@fut-stats/domain';
import { lineupSchema, matchViewSchema, roundDetailSchema } from '@fut-stats/shared';
import request from 'supertest';
import { loginAs } from '../test/auth';
import { createTestApp, resetDatabase, type TestApp } from '../test/test-app';
import { seed } from '../seed/seed';
import { SEED_GROUP } from '../seed/seed-data';

const NOW = new Date('2026-10-24T15:10:00Z');

/** Todo jogador que as telas mostram (rodada, times, jogo) vem com o bonequinho dele. */
describe('bonequinho nas telas da rodada', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(t.prisma);
  });

  afterAll(async () => {
    await t.app.close();
  });

  const server = () => t.app.getHttpServer();

  async function setup(scenario: 'resenha' | 'times') {
    await seed(t.prisma, { scenario, now: NOW });
    const group = await t.prisma.group.findUniqueOrThrow({ where: { slug: SEED_GROUP.slug } });
    const round = await t.prisma.round.findFirstOrThrow({
      where: { groupId: group.id },
      orderBy: { number: 'desc' },
    });
    const memberships = await t.prisma.membership.findMany({ where: { groupId: group.id } });
    const avatars = new Map<string, PlayerAvatar>(
      memberships.map((m) => [
        m.id,
        { skin: m.avatarSkin, hair: m.avatarHair, hairColor: m.avatarHairColor },
      ]),
    );
    // um jogador comum: o bonequinho aparece para qualquer membro, não só para o admin
    const player = memberships.find((m) => m.role === 'PLAYER')!;
    const cookie = loginAs(t, player.userId);
    const base = `/api/groups/${group.id}/rounds/${round.id}`;
    return { avatars, cookie, base };
  }

  it('C28: detalhe da rodada, times e jogo trazem o avatar de todo jogador', async () => {
    const { avatars, cookie, base } = await setup('resenha');

    const detail = await request(server()).get(base).set('Cookie', cookie).expect(200);
    expect(roundDetailSchema.safeParse(detail.body).success).toBe(true);
    const present = [
      ...detail.body.attendance.confirmed,
      ...detail.body.attendance.declined,
      ...detail.body.attendance.pending,
    ];
    expect(present.length).toBeGreaterThan(0);
    for (const m of present) expect(m.avatar).toEqual(avatars.get(m.membershipId));

    const lineup = await request(server()).get(`${base}/lineup`).set('Cookie', cookie).expect(200);
    expect(lineupSchema.safeParse(lineup.body).success).toBe(true);
    const placed = (['WHITE', 'BLACK'] as const).flatMap((team) => [
      ...lineup.body.teams[team].starters,
      ...lineup.body.teams[team].reserves,
    ]);
    expect(placed.length).toBeGreaterThanOrEqual(14);
    for (const m of placed) expect(m.avatar).toEqual(avatars.get(m.membershipId));

    const match = await request(server()).get(`${base}/match`).set('Cookie', cookie).expect(200);
    expect(matchViewSchema.safeParse(match.body).success).toBe(true);
    expect(match.body.players.length).toBe(placed.length);
    expect(match.body.events.length).toBeGreaterThan(0);
    for (const p of match.body.players) expect(p.avatar).toEqual(avatars.get(p.membershipId));
    for (const e of match.body.events) expect(e.avatar).toEqual(avatars.get(e.membershipId));
  });

  it('C28: quem não está escalado ainda (times por montar) também vem com o avatar', async () => {
    const { avatars, cookie, base } = await setup('times');

    const lineup = await request(server()).get(`${base}/lineup`).set('Cookie', cookie).expect(200);

    const all = [
      ...lineup.body.unassigned,
      ...(['WHITE', 'BLACK'] as const).flatMap((team) => [
        ...lineup.body.teams[team].starters,
        ...lineup.body.teams[team].reserves,
      ]),
    ];
    expect(all.length).toBeGreaterThan(0);
    for (const m of all) expect(m.avatar).toEqual(avatars.get(m.membershipId));
  });

  it('C28: o avatar editado aparece no jogo e nos times na hora', async () => {
    const { cookie, base } = await setup('resenha');
    const match = await request(server()).get(`${base}/match`).set('Cookie', cookie).expect(200);
    const target = match.body.players[0];
    await t.prisma.membership.update({
      where: { id: target.membershipId },
      data: { avatarSkin: 'DARK', avatarHair: 'MOHAWK', avatarHairColor: 'RED' },
    });

    const after = await request(server()).get(`${base}/match`).set('Cookie', cookie).expect(200);

    const changed = { skin: 'DARK', hair: 'MOHAWK', hairColor: 'RED' };
    expect(
      after.body.players.find(
        (p: { membershipId: string }) => p.membershipId === target.membershipId,
      ).avatar,
    ).toEqual(changed);
    for (const e of after.body.events.filter(
      (e: { membershipId: string }) => e.membershipId === target.membershipId,
    )) {
      expect(e.avatar).toEqual(changed);
    }
  });
});
