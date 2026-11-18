import { describe, expect, it } from 'vitest';
import { NOTIFICATION_TYPES, notificationRecipients } from './recipients';

const ids = (count: number, prefix = 'm') =>
  Array.from({ length: count }, (_, i) => `${prefix}${i}`);

describe('notificationRecipients', () => {
  it('C1: rodada criada vai para os 19 outros ativos do grupo de 20', () => {
    const active = ids(20);
    const recipients = notificationRecipients('ROUND_CREATED', {
      activeMemberIds: active,
      actorId: 'm0',
    });
    expect(recipients).toEqual(active.slice(1));
    expect(recipients).toHaveLength(19);
  });

  it('C2: times publicados vão para os 15 escalados que não são o admin, e nenhum dos 4 de fora', () => {
    const active = ids(20);
    const lineup = active.slice(0, 16);
    const recipients = notificationRecipients('TEAMS_PUBLISHED', {
      activeMemberIds: active,
      lineupIds: lineup,
      actorId: 'm3',
    });
    expect(recipients).toHaveLength(15);
    expect(recipients).not.toContain('m3');
    expect(recipients.every((id) => lineup.includes(id))).toBe(true);
  });

  it('C3: votação aberta vai para os 15 ativos que jogaram (um foi desativado), menos quem abriu', () => {
    const lineup = ids(16);
    const active = ids(20).filter((id) => id !== 'm5');
    const recipients = notificationRecipients('VOTING_OPENED', {
      activeMemberIds: active,
      lineupIds: lineup,
      actorId: 'm1',
    });
    expect(recipients).toHaveLength(14);
    expect(recipients).not.toContain('m5');
    expect(recipients).not.toContain('m1');

    // admin que não jogou: ninguém sai por causa dele
    const adminOutside = notificationRecipients('VOTING_OPENED', {
      activeMemberIds: active,
      lineupIds: lineup,
      actorId: 'm19',
    });
    expect(adminOutside).toHaveLength(15);
    expect(adminOutside).not.toContain('m5');
  });

  it('C4: resultado sem ator (fechamento automático) vai para todos os ativos; com o admin, para todos menos ele', () => {
    const active = ids(20);
    expect(
      notificationRecipients('RESULT_OUT', { activeMemberIds: active, actorId: null }),
    ).toEqual(active);
    const byAdmin = notificationRecipients('RESULT_OUT', {
      activeMemberIds: active,
      actorId: 'm7',
    });
    expect(byAdmin).toHaveLength(19);
    expect(byAdmin).not.toContain('m7');
  });

  it('C5: lista vazia de escalados não tem destinatário, em qualquer tipo', () => {
    for (const type of ['TEAMS_PUBLISHED', 'VOTING_OPENED'] as const) {
      expect(
        notificationRecipients(type, { activeMemberIds: ids(5), lineupIds: [], actorId: null }),
      ).toEqual([]);
      expect(notificationRecipients(type, { activeMemberIds: ids(5), actorId: null })).toEqual([]);
    }
    for (const type of NOTIFICATION_TYPES) {
      expect(
        notificationRecipients(type, { activeMemberIds: [], lineupIds: [], actorId: null }),
      ).toEqual([]);
    }
  });

  it('não repete ninguém e não mexe nas listas de entrada', () => {
    const active = ['a', 'b', 'a', 'c'];
    const lineup = ['c', 'a', 'a', 'x'];
    expect(
      notificationRecipients('ROUND_CREATED', { activeMemberIds: active, actorId: null }),
    ).toEqual(['a', 'b', 'c']);
    expect(
      notificationRecipients('TEAMS_PUBLISHED', {
        activeMemberIds: active,
        lineupIds: lineup,
        actorId: null,
      }),
    ).toEqual(['c', 'a']);
    expect(active).toEqual(['a', 'b', 'a', 'c']);
    expect(lineup).toEqual(['c', 'a', 'a', 'x']);
  });
});
