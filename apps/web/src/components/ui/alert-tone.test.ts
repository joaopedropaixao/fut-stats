import { describe, expect, it } from 'vitest';
import { ALERT_TONES, type AlertToneKey } from './alert-tone';

const TYPES = Object.keys(ALERT_TONES) as AlertToneKey[];

describe('cor de identidade dos avisos do Feed', () => {
  it('cada tipo tem a cor combinada com o dono', () => {
    expect(ALERT_TONES.IN_PROGRESS.frame).toBe('var(--color-danger)');
    expect(ALERT_TONES.POST_MATCH.frame).toBe('var(--color-warning)');
    expect(ALERT_TONES.RESULT.frame).toBe('var(--color-gold)');
    expect(ALERT_TONES.VOTING.frame).toBe('var(--color-silver)');
    expect(ALERT_TONES.PRESENCE.frame).toBe('var(--color-success)');
    expect(ALERT_TONES.TEAMS_PUBLISHED.frame).toBe('var(--color-team-white)');
  });

  it('as molduras são todas diferentes', () => {
    expect(new Set(TYPES.map((t) => ALERT_TONES[t].frame)).size).toBe(TYPES.length);
  });

  it('o amarelo de ação nunca é cor de identidade (só a tecla)', () => {
    for (const type of TYPES) {
      const { frame, ink, band, stripe } = ALERT_TONES[type];
      expect([frame, ink, band, stripe].join(' ')).not.toMatch(/accent/);
    }
  });

  it('a votação é prata com a faixa listrada, para não parecer o prata do pódio', () => {
    expect(ALERT_TONES.VOTING.bandImage).toContain('repeating-linear-gradient');
    for (const type of TYPES.filter((t) => t !== 'VOTING')) {
      expect(ALERT_TONES[type].bandImage).toBeUndefined();
    }
  });

  it('os times saíram: faixa preta e o corte diagonal branco/preto na linha', () => {
    expect(ALERT_TONES.TEAMS_PUBLISHED.band).toBe('bg-team-black');
    expect(ALERT_TONES.TEAMS_PUBLISHED.stripe).toContain('#fff 50%, #000 50%');
  });
});
