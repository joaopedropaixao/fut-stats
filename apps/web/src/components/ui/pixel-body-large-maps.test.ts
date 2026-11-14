import { describe, expect, it } from 'vitest';
import { AVATAR_HAIR_COLORS, AVATAR_HAIRS, AVATAR_SKINS, DEFAULT_AVATAR } from '../../lib/avatar';
import { faceMap } from './pixel-face-maps';
import {
  BODY_LARGE_HEIGHT,
  BODY_LARGE_WIDTH,
  bodyLargeMap,
  bodyLargePalette,
} from './pixel-body-large-maps';
import { HAIR_SHADE_VAR, HAIR_VAR, shadeHair, spritePaths } from './pixel-sprite-maps';

const bodies = AVATAR_HAIRS.map((hair) => ({
  hair,
  map: bodyLargeMap({ ...DEFAULT_AVATAR, hair }),
}));
const withHair = bodies.filter(({ hair }) => hair !== 'BALD');

describe('corpo grande do bonequinho (16 x 24)', () => {
  it.each(bodies)('C54: $hair tem 24 linhas de 16 colunas', ({ map }) => {
    expect(BODY_LARGE_WIDTH).toBe(16);
    expect(BODY_LARGE_HEIGHT).toBe(24);
    expect(map).toHaveLength(BODY_LARGE_HEIGHT);
    expect(map.every((row) => row.length === BODY_LARGE_WIDTH)).toBe(true);
  });

  it('C54: os seis cabelos são seis desenhos diferentes', () => {
    expect(new Set(bodies.map((b) => b.map.join('/'))).size).toBe(AVATAR_HAIRS.length);
  });

  it('C54: cada estilo também difere dos outros só na cabeça e no ombro (o resto do corpo é igual)', () => {
    const legs = new Set(bodies.map((b) => b.map.slice(12).join('/')));
    expect(legs.size).toBe(1);
  });

  it.each(bodies)('C54: $hair é simétrico (esquerda e direita iguais)', ({ map }) => {
    map.forEach((row, y) => expect(row, `linha ${y}`).toBe([...row].toReversed().join('')));
  });

  it.each(bodies)('C54: $hair tem contorno de 1 px em volta da cabeça e do corpo', ({ map }) => {
    // o contorno `K` fecha a cabeça por baixo (queixo) e os dois lados do tronco e das pernas
    expect(map[7]).toContain('KKKK');
    for (const y of [12, 13, 17, 20]) {
      expect(map[y]!.replaceAll('.', '')[0], `linha ${y}`).toBe('K');
    }
    // nenhum pixel de pele ou de cabelo encosta no vazio, dos lados ou por cima, sem um contorno no meio
    // (o queixo fecha em diagonal, como no rosto 12 x 12)
    map.forEach((row, y) =>
      [...row].forEach((c, x) => {
        if (!'shH'.includes(c)) return;
        for (const [dx, dy] of [
          [-1, 0],
          [1, 0],
          [0, -1],
        ] as const) {
          const near = map[y + dy]?.[x + dx];
          // fora da grade (a borda de cima) não conta
          if (near !== undefined) expect(near, `(${x},${y}) ${c} ao lado de vazio`).not.toBe('.');
        }
      }),
    );
  });

  it('C54: os olhos são de 1 px (dois pontos de contorno no meio do rosto)', () => {
    const eyeRow = bodyLargeMap({ ...DEFAULT_AVATAR, hair: 'SHORT' })[4]!;
    expect(eyeRow.match(/K/g)).toHaveLength(4);
  });

  it('C54: só usa letras que a paleta conhece', () => {
    const palette = bodyLargePalette(DEFAULT_AVATAR, 'white');
    for (const { map } of bodies) {
      for (const char of new Set(map.join(''))) {
        expect(char === '.' || char in palette, `letra ${char}`).toBe(true);
      }
    }
  });

  it('C54: careca não tem cabelo; os outros têm cabelo e sombra de cabelo', () => {
    expect(bodyLargeMap({ ...DEFAULT_AVATAR, hair: 'BALD' }).join('')).not.toMatch(/[hH]/);
    for (const { hair, map } of withHair) {
      expect(map.join(''), hair).toContain('h');
      expect(map.join(''), `${hair} sem sombra`).toContain('H');
    }
  });

  it('C54: a camisa do time entra na paleta, sem time é neutra', () => {
    expect(bodyLargePalette(DEFAULT_AVATAR, 'white').T).toBe('#FFFFFF');
    expect(bodyLargePalette(DEFAULT_AVATAR, 'black').T).toBe('#2E2E2E');
    expect(bodyLargePalette(DEFAULT_AVATAR, null).T).toBe('var(--color-text-muted)');
  });
});

describe('dois tons de cabelo (C53)', () => {
  it('C53: toda cor de cabelo tem base e sombra, as duas de token e diferentes', () => {
    for (const color of AVATAR_HAIR_COLORS) {
      expect(HAIR_VAR[color]).toMatch(/^var\(--color-hair-[a-z]+\)$/);
      expect(HAIR_SHADE_VAR[color]).toMatch(/^var\(--color-hair-[a-z]+-shade\)$/);
      expect(HAIR_SHADE_VAR[color]).not.toBe(HAIR_VAR[color]);
    }
    expect(new Set(AVATAR_HAIR_COLORS.map((c) => HAIR_VAR[c])).size).toBe(
      AVATAR_HAIR_COLORS.length,
    );
  });

  it('C53: a paleta do corpo grande e a do rosto trazem os dois tons e o contorno', () => {
    for (const hairColor of AVATAR_HAIR_COLORS) {
      const palette = bodyLargePalette({ ...DEFAULT_AVATAR, hairColor }, null);
      expect(palette.h).toBe(HAIR_VAR[hairColor]);
      expect(palette.H).toBe(HAIR_SHADE_VAR[hairColor]);
      expect(palette.K).toBe('var(--color-outline)');
    }
  });

  it('C53: a sombra fica na borda de baixo do cabelo (o pixel sem cabelo logo abaixo)', () => {
    expect(shadeHair(['hh.', 'h..'])).toEqual(['hH.', 'H..']);
    expect(shadeHair(['h', 'h', 's'])).toEqual(['h', 'H', 's']);
  });

  it.each(AVATAR_HAIRS.filter((hair) => hair !== 'BALD'))(
    'C53: o rosto 12 x 12 %s também usa os dois tons',
    (hair) => {
      const map = faceMap({ ...DEFAULT_AVATAR, hair }).join('');
      expect(map).toContain('h');
      expect(map).toContain('H');
    },
  );

  it('C53: cada cor de cabelo pinta o corpo grande com cores diferentes das outras', () => {
    const paintings = AVATAR_HAIR_COLORS.map((hairColor) => {
      const avatar = { skin: 'LIGHT', hair: 'SHORT', hairColor } as const;
      return Object.keys(spritePaths(bodyLargeMap(avatar), bodyLargePalette(avatar, null))).join();
    });
    expect(new Set(paintings).size).toBe(AVATAR_HAIR_COLORS.length);
  });

  it('C53: as cores de cabelo não repetem nenhum tom de pele', () => {
    const colors = new Set(
      AVATAR_SKINS.map((skin) => bodyLargePalette({ ...DEFAULT_AVATAR, skin }, null).s),
    );
    for (const hairColor of AVATAR_HAIR_COLORS) {
      expect(colors.has(HAIR_VAR[hairColor])).toBe(false);
    }
  });
});
