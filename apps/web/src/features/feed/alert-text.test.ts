import type { FeedAlert } from '@fut-stats/shared';
import { describe, expect, it } from 'vitest';
import { alertAriaLabel, alertText } from './alert-text';

const alert = (type: FeedAlert['type'], me: FeedAlert['me'] = {}): FeedAlert => ({
  type,
  roundId: 'r12',
  roundNumber: 12,
  scheduledAt: '2026-11-14T21:00:00.000Z',
  me,
});

describe('texto da linha de aviso (C27, C28, C33)', () => {
  it('votação: falta o voto, já votou, e quem não jogou', () => {
    expect(alertText(alert('VOTING', { played: true, voted: false }))).toEqual({
      title: 'Votação aberta',
      situation: 'Rodada 12 · falta o seu voto',
      to: '/rodadas/r12/votar',
    });
    expect(alertText(alert('VOTING', { played: true, voted: true })).situation).toBe(
      'Rodada 12 · você já votou',
    );
    expect(alertText(alert('VOTING', { played: false, voted: false })).situation).toBe(
      'Rodada 12 · só quem jogou vota',
    );
  });

  it('presença: responda, vou e não vou', () => {
    expect(alertText(alert('PRESENCE', { attendance: null }))).toEqual({
      title: 'Presença aberta',
      situation: 'Rodada 12 · responda',
      to: '/rodadas/r12',
    });
    expect(alertText(alert('PRESENCE', { attendance: true })).situation).toBe(
      'Rodada 12 · você vai',
    );
    expect(alertText(alert('PRESENCE', { attendance: false })).situation).toBe(
      'Rodada 12 · você não vai',
    );
  });

  it('resultado: novo chama para abrir o pacote; aberto vira "Resultado · Rodada 12"', () => {
    expect(alertText(alert('RESULT'))).toEqual({
      title: 'O resultado saiu',
      situation: 'Rodada 12 · abra o pacote',
      to: '/rodadas/r12/resultado',
    });
    expect(alertText(alert('RESULT'), true)).toEqual({
      title: 'Resultado',
      situation: 'Rodada 12',
      to: '/rodadas/r12/resultado',
    });
  });

  it('times publicados: o time de quem foi escalado, ou "não está escalado"; leva à aba Times', () => {
    expect(alertText(alert('TEAMS_PUBLISHED', { team: 'BLACK' }))).toEqual({
      title: 'Times publicados',
      situation: 'Rodada 12 · você joga no Preto',
      to: '/times',
    });
    expect(alertText(alert('TEAMS_PUBLISHED', { team: null })).situation).toBe(
      'Rodada 12 · você não está escalado',
    );
  });

  it('jogo e Resenha levam à tela do jogo', () => {
    expect(alertText(alert('IN_PROGRESS', { team: 'WHITE' }))).toEqual({
      title: 'Em jogo',
      situation: 'Rodada 12 · você joga no Branco',
      to: '/rodadas/r12/jogo',
    });
    expect(alertText(alert('IN_PROGRESS', { team: null })).situation).toBe(
      'Rodada 12 · a bola está rolando',
    );
    expect(alertText(alert('POST_MATCH', { team: null }))).toEqual({
      title: 'Hora da Resenha',
      situation: 'Rodada 12 · confira os lances',
      to: '/rodadas/r12/jogo',
    });
    expect(alertText(alert('POST_MATCH', { team: 'WHITE' })).situation).toBe(
      'Rodada 12 · lance seus gols e assistências',
    );
  });

  it('o nome para leitor de tela junta tipo, rodada e situação', () => {
    expect(alertAriaLabel(alertText(alert('VOTING', { played: true, voted: false })))).toBe(
      'Votação aberta, rodada 12, falta o seu voto',
    );
    expect(alertAriaLabel(alertText(alert('RESULT'), true))).toBe('Resultado, rodada 12');
  });
});
