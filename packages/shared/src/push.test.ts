import { describe, expect, it } from 'vitest';
import {
  NOTIFICATION_TYPES,
  notificationContent,
  pushPayloadSchema,
  isPushServiceEndpoint,
  pushSubscriptionInputSchema,
  type NotificationData,
} from './index';

// 24 out 2026 é sábado; 12h UTC = 9h em Brasília (UTC-3, sem horário de verão).
const data: NotificationData = {
  groupId: 'g1',
  groupName: 'Pelada do Sábado',
  roundId: 'r13',
  roundNumber: 13,
  scheduledAt: '2026-10-24T12:00:00.000Z',
  votingDeadline: '2026-10-25T00:00:00.000Z',
};

describe('notificationContent', () => {
  it('C21: ROUND_CREATED traz a data real da rodada e abre o detalhe', () => {
    expect(notificationContent('ROUND_CREATED', data)).toEqual({
      type: 'ROUND_CREATED',
      title: 'Pelada do Sábado',
      body: 'Rodada 13 marcada: sáb, 24 out, 9h. Confirme sua presença.',
      url: '/rodadas/r13?grupo=g1',
      tag: 'ROUND_CREATED:r13',
    });
  });

  it('C21: TEAMS_PUBLISHED abre a aba Times', () => {
    expect(notificationContent('TEAMS_PUBLISHED', data)).toEqual({
      type: 'TEAMS_PUBLISHED',
      title: 'Pelada do Sábado',
      body: 'Os times da rodada 13 saíram. Veja em que time você joga.',
      url: '/times?grupo=g1',
      tag: 'TEAMS_PUBLISHED:r13',
    });
  });

  it('C21: VOTING_OPENED diz o prazo real e abre a votação', () => {
    expect(notificationContent('VOTING_OPENED', data)).toEqual({
      type: 'VOTING_OPENED',
      title: 'Pelada do Sábado',
      body: 'Votação aberta. Dê suas notas até sáb às 21h.',
      url: '/rodadas/r13/votar?grupo=g1',
      tag: 'VOTING_OPENED:r13',
    });
  });

  it('C21: RESULT_OUT chama para o pacote e não revela o Craque', () => {
    const content = notificationContent('RESULT_OUT', data);
    expect(content).toEqual({
      type: 'RESULT_OUT',
      title: 'Pelada do Sábado',
      body: 'O resultado da rodada 13 saiu. Quem foi o craque?',
      url: '/rodadas/r13/resultado?grupo=g1',
      tag: 'RESULT_OUT:r13',
    });
  });

  it('C21: o dia da semana vem da data, nunca fixo, e a hora quebrada leva os minutos', () => {
    const sunday = notificationContent('ROUND_CREATED', {
      ...data,
      scheduledAt: '2026-11-01T12:30:00.000Z',
    });
    expect(sunday.body).toBe('Rodada 13 marcada: dom, 1 nov, 9h30. Confirme sua presença.');
    const deadline = notificationContent('VOTING_OPENED', {
      ...data,
      votingDeadline: '2026-11-02T12:30:00.000Z',
    });
    expect(deadline.body).toBe('Votação aberta. Dê suas notas até seg às 9h30.');
  });

  it('C21: a data usa o fuso de Brasília (virada de dia perto da meia-noite UTC)', () => {
    // 02h UTC de domingo ainda é sábado 23h em Brasília
    const late = notificationContent('ROUND_CREATED', {
      ...data,
      scheduledAt: '2026-10-25T02:00:00.000Z',
    });
    expect(late.body).toBe('Rodada 13 marcada: sáb, 24 out, 23h. Confirme sua presença.');
  });

  it('C21: sem prazo informado, a votação aberta não inventa data', () => {
    const { votingDeadline: _ignored, ...withoutDeadline } = data;
    void _ignored;
    expect(notificationContent('VOTING_OPENED', withoutDeadline).body).toBe(
      'Votação aberta. Dê suas notas.',
    );
  });

  it('C21: todo tipo gera um payload que o schema aceita e a tag é tipo:rodada', () => {
    for (const type of NOTIFICATION_TYPES) {
      const content = notificationContent(type, data);
      expect(pushPayloadSchema.parse(content)).toEqual(content);
      expect(content.type).toBe(type);
      expect(content.tag).toBe(`${type}:r13`);
      expect(content.url).toContain('?grupo=g1');
    }
  });
});

describe('pushSubscriptionInputSchema', () => {
  const keys = { p256dh: 'abc', auth: 'def' };
  it('aceita o JSON do navegador e recusa http, endpoint grande e corpo sem keys', () => {
    expect(
      pushSubscriptionInputSchema.safeParse({ endpoint: 'https://fcm.googleapis.com/fcm/send/x', keys })
        .success,
    ).toBe(true);
    expect(
      pushSubscriptionInputSchema.safeParse({ endpoint: 'http://fcm.googleapis.com/fcm/send/x', keys })
        .success,
    ).toBe(false);
    expect(
      pushSubscriptionInputSchema.safeParse({
        endpoint: `https://fcm.googleapis.com/fcm/send/${'a'.repeat(2000)}`,
        keys,
      }).success,
    ).toBe(false);
    expect(
      pushSubscriptionInputSchema.safeParse({ endpoint: 'https://fcm.googleapis.com/fcm/send/x' }).success,
    ).toBe(false);
  });
});

describe('isPushServiceEndpoint', () => {
  it('aceita os serviços de push do Google, da Mozilla, da Apple e da Microsoft', () => {
    for (const endpoint of [
      'https://fcm.googleapis.com/fcm/send/abc',
      'https://updates.push.services.mozilla.com/wpush/v2/abc',
      'https://web.push.apple.com/QGx',
      'https://wns2-by3p.notify.windows.com/w/?token=abc',
    ])
      expect(isPushServiceEndpoint(endpoint), endpoint).toBe(true);
  });

  it('recusa host interno, outro host, porta, usuário e o sufixo sem o ponto (SSRF)', () => {
    for (const endpoint of [
      'https://localhost/push',
      'https://127.0.0.1/push',
      'https://169.254.169.254/latest/meta-data',
      'https://api.internal/push',
      'https://push.example.com/x',
      'https://fcm.googleapis.com:8443/fcm/send/abc',
      'https://user:pass@fcm.googleapis.com/fcm/send/abc',
      'https://evilpush.apple.com/x',
      'https://fcm.googleapis.com.evil.com/x',
      'http://fcm.googleapis.com/fcm/send/abc',
      'não é url',
    ])
      expect(isPushServiceEndpoint(endpoint), endpoint).toBe(false);
    expect(
      pushSubscriptionInputSchema.safeParse({
        endpoint: 'https://169.254.169.254/latest/meta-data',
        keys: { p256dh: 'abc', auth: 'def' },
      }).success,
    ).toBe(false);
  });
});
