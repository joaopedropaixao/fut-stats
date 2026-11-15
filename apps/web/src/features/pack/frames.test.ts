import { describe, expect, it } from 'vitest';
import { buildDeck } from './deck';
import { buildFrames, cluesAt, clueTimes, frameDuration, WALKOUT_AT } from './frames';
import { player, result } from './fixtures';
import { ratingSteps } from './rating-steps';

const ronaldinho = player('a', 'Ronaldinho', 9.1, 1);
const zague = player('b', 'Zagueirão', 4.2, 9);
const eu = player('me', 'Dedé', 7.4, 3);

describe('quadros do pacote', () => {
  it('fechado, suspense, rasgo, uma carta por quadro e o final', () => {
    const deck = buildDeck(
      result({ mvps: [ronaldinho], flops: [zague], players: [ronaldinho, eu, zague] }),
    );
    expect(buildFrames(deck).map((f) => (f.kind === 'card' ? f.card.kind : f.kind))).toEqual([
      'closed',
      'shake',
      'tear',
      'craque',
      'flop',
      'mine',
      'final',
    ]);
  });

  it('C16: dois Craques fazem o walkout um depois do outro e depois ficam juntos', () => {
    const outro = player('c', 'Zé', 9.1, 1);
    const deck = buildDeck(
      result({
        mvps: [ronaldinho, outro],
        flops: [zague],
        players: [ronaldinho, outro, eu, zague],
      }),
    );
    expect(buildFrames(deck).map((f) => (f.kind === 'card' ? f.card.kind : f.kind))).toEqual([
      'closed',
      'shake',
      'tear',
      'craque',
      'craque',
      'duo',
      'flop',
      'mine',
      'final',
    ]);
  });

  it('C23: o fechado e o final esperam; o resto segue sozinho em torno de 2 s por carta', () => {
    const deck = buildDeck(
      result({ mvps: [ronaldinho], flops: [zague], players: [ronaldinho, eu, zague] }),
    );
    const durations = buildFrames(deck).map(frameDuration);
    expect(durations[0]).toBeNull();
    expect(durations.at(-1)).toBeNull();
    for (const ms of durations.slice(1, -1)) expect(ms).toBeLessThanOrEqual(2500);
    // do toque até a última carta parar, o walkout do Craque termina dentro do quadro
    expect(WALKOUT_AT.face + 600).toBeLessThanOrEqual(durations[3]!);
  });
});

describe('degraus da nota', () => {
  it('C5: sobe em degraus crescentes até o valor, na casa de uma decimal', () => {
    const steps = ratingSteps(9.1);
    expect(steps.at(-1)).toBe(9.1);
    expect(steps).toEqual([...steps].sort((a, b) => a - b));
    expect(new Set(steps).size).toBe(steps.length);
    for (const s of steps) expect(Math.round(s * 10) / 10).toBe(s);
  });

  it('nota baixa não repete degrau', () => {
    const steps = ratingSteps(1);
    expect(new Set(steps).size).toBe(steps.length);
    expect(steps.at(-1)).toBe(1);
  });

  it('C5: as pistas acendem na ordem time, posição, nota e só depois o rosto', () => {
    expect(cluesAt(0, 9.1)).toEqual({ team: false, position: false, rating: null, face: false });
    expect(cluesAt(WALKOUT_AT.team, 9.1).team).toBe(true);
    const pos = cluesAt(WALKOUT_AT.position, 9.1);
    expect(pos).toMatchObject({ team: true, position: true, rating: null, face: false });
    const mid = cluesAt(WALKOUT_AT.rating + WALKOUT_AT.ratingStep, 9.1);
    expect(mid.rating).toBe(ratingSteps(9.1)[1]);
    expect(mid.face).toBe(false);
    const end = cluesAt(WALKOUT_AT.face, 9.1);
    expect(end).toMatchObject({ face: true, rating: 9.1 });
  });

  it('o rosto só vem depois do último degrau da nota', () => {
    const times = clueTimes(9.1);
    expect(times.at(-1)).toBe(WALKOUT_AT.face);
    expect(Math.max(...times.slice(0, -1))).toBeLessThan(WALKOUT_AT.face);
  });
});
