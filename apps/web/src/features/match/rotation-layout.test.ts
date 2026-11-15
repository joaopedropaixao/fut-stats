import { describe, expect, it } from 'vitest';
import { rotationLayoutFailures, type RotationLayoutMeasurement } from './rotation-layout';

const widths = [320, 375, 390, 430, 1280];

function measurement(width: number, nicknameBottom: number): RotationLayoutMeasurement {
  return {
    width,
    navigationTop: 776,
    contentTop: 24,
    contentBottom: 768,
    contentOverflowY: 'auto',
    enter: { top: 620, bottom: 700 },
    leave: { top: 620, bottom: 700 },
    footer: { top: 720, bottom: 744 },
    nicknames: [
      { value: 'Marcelinho', rect: { top: nicknameBottom - 40, bottom: nicknameBottom } },
    ],
  };
}

describe('rotationLayoutFailures', () => {
  it('reproduz o cruzamento do apelido de dez letras em todas as larguras QA', () => {
    for (const width of widths) {
      const failures = rotationLayoutFailures(measurement(width, width === 320 ? 799.5 : 776.4));
      expect(
        failures.some((failure) => failure.includes('Marcelinho')),
        `${width}px`,
      ).toBe(true);
    }
  });

  it('aceita ENTRA, SAI, Marcelinho e rodapé inteiramente acima da navegação', () => {
    for (const width of widths) {
      expect(rotationLayoutFailures(measurement(width, 730)), `${width}px`).toEqual([]);
    }
  });

  it('detecta quando ENTRA, SAI ou JOGO / DE passam por baixo da navegação', () => {
    const broken = measurement(390, 730);
    broken.enter.bottom = 776.4;
    broken.leave.bottom = 779.5;
    broken.footer.bottom = 799.5;

    const failures = rotationLayoutFailures(broken);
    expect(failures.some((failure) => failure.includes('▲ ENTRA'))).toBe(true);
    expect(failures.some((failure) => failure.includes('▼ SAI'))).toBe(true);
    expect(failures.some((failure) => failure.includes('JOGO / DE'))).toBe(true);
  });

  it('reprova a página sem área rolável reservada para a navegação', () => {
    expect(
      rotationLayoutFailures({ ...measurement(390, 730), contentOverflowY: 'visible' }),
    ).toContain('390px: conteúdo não rola em área reservada');
  });
});
