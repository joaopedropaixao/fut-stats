import { describe, expect, it } from 'vitest';
import { pickCurrentRound, pickLatestResult, pickVotingRound, type RoundAtTime } from './current';
import type { RoundStatus } from './status';

const now = new Date('2026-10-23T21:00:00Z');
const at = (id: string, status: RoundStatus, iso: string): RoundAtTime & { id: string } => ({
  id,
  status,
  scheduledAt: new Date(iso),
});

describe('pickCurrentRound', () => {
  it('sem rodadas devolve null', () => {
    expect(pickCurrentRound([], now)).toBeNull();
  });

  it('rodada em jogo vem antes de qualquer próxima', () => {
    const rounds = [
      at('proxima', 'SCHEDULED', '2026-10-24T20:00:00Z'),
      at('em-jogo', 'IN_PROGRESS', '2026-10-23T20:00:00Z'),
    ];
    expect(pickCurrentRound(rounds, now)?.id).toBe('em-jogo');
  });

  it('com mais de uma em jogo, fica a de horário mais recente', () => {
    const rounds = [
      at('antiga', 'IN_PROGRESS', '2026-10-16T20:00:00Z'),
      at('hoje', 'IN_PROGRESS', '2026-10-23T20:00:00Z'),
    ];
    expect(pickCurrentRound(rounds, now)?.id).toBe('hoje');
  });

  it('sem jogo, a próxima é a de antes do jogo com o horário mais cedo', () => {
    const rounds = [
      at('depois', 'SCHEDULED', '2026-10-30T20:00:00Z'),
      at('antes', 'TEAMS_PUBLISHED', '2026-10-24T20:00:00Z'),
    ];
    expect(pickCurrentRound(rounds, now)?.id).toBe('antes');
  });

  it('no dia do jogo, passado o horário e ainda sem começar, a rodada continua sendo a atual', () => {
    const rounds = [
      at('hoje', 'TEAMS_PUBLISHED', '2026-10-23T20:00:00Z'),
      at('semana-que-vem', 'SCHEDULED', '2026-10-30T20:00:00Z'),
    ];
    expect(pickCurrentRound(rounds, now)?.id).toBe('hoje');
  });

  it('rodada não começada com horário passado há mais de 24 h é ignorada', () => {
    const rounds = [
      at('esquecida', 'SCHEDULED', '2026-10-22T20:59:00Z'),
      at('proxima', 'SCHEDULED', '2026-10-30T20:00:00Z'),
    ];
    expect(pickCurrentRound(rounds, now)?.id).toBe('proxima');
  });

  it('o limite de horas é configurável', () => {
    const rounds = [at('hoje', 'SCHEDULED', '2026-10-23T18:00:00Z')];
    expect(pickCurrentRound(rounds, now, { staleAfterHours: 2 })).toBeNull();
    expect(pickCurrentRound(rounds, now, { staleAfterHours: 3 })?.id).toBe('hoje');
  });

  it('C12: a Resenha pós-jogo conta como em jogo e vem antes da próxima', () => {
    const rounds = [
      at('proxima', 'SCHEDULED', '2026-10-24T20:00:00Z'),
      at('resenha', 'POST_MATCH', '2026-10-23T20:00:00Z'),
    ];
    expect(pickCurrentRound(rounds, now)?.id).toBe('resenha');
  });

  it('rodada em votação ou encerrada não é a atual', () => {
    const rounds = [
      at('votacao', 'VOTING', '2026-10-23T20:00:00Z'),
      at('encerrada', 'CLOSED', '2026-10-16T20:00:00Z'),
    ];
    expect(pickCurrentRound(rounds, now)).toBeNull();
  });
});

describe('pickVotingRound', () => {
  const round = (id: string, status: RoundStatus, iso: string) => at(id, status, iso);

  it('C7: devolve a VOTING de data mais recente, ignorando as outras etapas', () => {
    const rounds = [
      round('velha', 'VOTING', '2026-10-09T20:00:00Z'),
      round('nova', 'VOTING', '2026-10-16T20:00:00Z'),
      round('fechada', 'CLOSED', '2026-10-23T20:00:00Z'),
      round('agendada', 'SCHEDULED', '2026-10-30T20:00:00Z'),
    ];
    expect(pickVotingRound(rounds)?.id).toBe('nova');
  });

  it('C7: sem nenhuma em votação, null', () => {
    expect(pickVotingRound([round('f', 'CLOSED', '2026-10-09T20:00:00Z')])).toBeNull();
    expect(pickVotingRound([])).toBeNull();
  });
});

describe('pickLatestResult', () => {
  const DAY = 24 * 3_600_000;
  const closed = (id: string, daysAgo: number | null, status: RoundStatus = 'CLOSED') => ({
    id,
    status,
    closedAt: daysAgo === null ? null : new Date(now.getTime() - daysAgo * DAY),
  });

  it('C8: a fechada há 6 dias entra; a de 8 dias, não', () => {
    expect(pickLatestResult([closed('seis', 6), closed('oito', 8)], now)?.id).toBe('seis');
    expect(pickLatestResult([closed('oito', 8)], now)).toBeNull();
  });

  it('C8: entre duas dentro do prazo, a que fechou por último', () => {
    expect(
      pickLatestResult([closed('tres', 3), closed('um', 1), closed('cinco', 5)], now)?.id,
    ).toBe('um');
  });

  it('o prazo é de RESULT_HIGHLIGHT_DAYS (7): exatamente 7 dias já saiu', () => {
    expect(pickLatestResult([closed('sete', 7)], now)).toBeNull();
    expect(pickLatestResult([closed('quase', 6.99)], now)?.id).toBe('quase');
  });

  it('o prazo pode ser trocado', () => {
    expect(pickLatestResult([closed('oito', 8)], now, { highlightDays: 10 })?.id).toBe('oito');
    expect(pickLatestResult([closed('dois', 2)], now, { highlightDays: 1 })).toBeNull();
  });

  it('só conta rodada CLOSED com closedAt', () => {
    expect(
      pickLatestResult([closed('votando', 1, 'VOTING'), closed('sem-data', null)], now),
    ).toBeNull();
  });
});
