import { describe, expect, it } from 'vitest';
import { AVATAR_HAIR_COLORS, AVATAR_HAIRS, AVATAR_SKINS, DEFAULT_AVATAR } from '../../lib/avatar';
import { FACE_SIZE, faceMap, facePalette } from './pixel-face-maps';
import {
  avatarPalette,
  bodySprite,
  markHairRim,
  needsRim,
  PLAYER_SPRITE,
  playerPalette,
  playerSpriteMap,
  REACTION_PALETTES,
  REACTION_SPRITES,
  REACTION_SPRITE_SIZE,
  shirtColors,
  spritePaths,
} from './pixel-sprite-maps';

describe('spritePaths', () => {
  it('junta pixels vizinhos da mesma cor num retângulo só', () => {
    expect(spritePaths(['.aa.', 'b..b'], { a: '#111', b: '#222' })).toEqual({
      '#111': 'M1 0h2v1h-2z',
      '#222': 'M0 1h1v1h-1zM3 1h1v1h-1z',
    });
  });

  it('ignora o que não está na paleta', () => {
    expect(spritePaths(['.x.'], { a: '#111' })).toEqual({});
  });
});

describe('corpo do bonequinho (8 x 12)', () => {
  it.each(AVATAR_HAIRS)('%s tem 12 linhas de 8 colunas', (hair) => {
    const map = bodySprite(hair);
    expect(map).toHaveLength(12);
    expect(map.every((row) => row.length === 8)).toBe(true);
  });

  it('o padrão é o cabelo curto', () => {
    expect(PLAYER_SPRITE).toEqual(bodySprite(DEFAULT_AVATAR.hair));
  });

  it.each(AVATAR_HAIRS)('%s é simétrico (esquerda e direita iguais)', (hair) => {
    bodySprite(hair).forEach((row, y) =>
      expect(row, `linha ${y}`).toBe([...row].toReversed().join('')),
    );
  });

  it('cada estilo desenha uma cabeça diferente', () => {
    const heads = AVATAR_HAIRS.map((hair) => bodySprite(hair).slice(0, 5).join('/'));
    expect(new Set(heads).size).toBe(AVATAR_HAIRS.length);
  });

  it('careca não tem pixel de cabelo; os outros têm', () => {
    expect(bodySprite('BALD').join('')).not.toContain('h');
    for (const hair of AVATAR_HAIRS.filter((h) => h !== 'BALD')) {
      expect(bodySprite(hair).join('')).toContain('h');
    }
  });

  it('as duas camisas diferem e sem time a camisa é neutra', () => {
    expect(shirtColors('white').T).not.toBe(shirtColors('black').T);
    expect(shirtColors(null).T).toBe('var(--color-text-muted)');
  });
});

describe('rosto do bonequinho (12 x 12)', () => {
  const faces = AVATAR_HAIRS.map((hair) => ({ hair, map: faceMap({ ...DEFAULT_AVATAR, hair }) }));

  it.each(faces)('$hair tem 12 linhas de 12 colunas', ({ map }) => {
    expect(map).toHaveLength(FACE_SIZE);
    expect(map.every((row) => row.length === FACE_SIZE)).toBe(true);
  });

  it('os seis cabelos são distinguíveis (cada um é um desenho)', () => {
    expect(new Set(faces.map((f) => f.map.join('/'))).size).toBe(AVATAR_HAIRS.length);
  });

  it.each(faces)('$hair é simétrico (esquerda e direita iguais)', ({ map }) => {
    map.forEach((row, y) => expect(row, `linha ${y}`).toBe([...row].toReversed().join('')));
  });

  it('só usa letras que a paleta conhece', () => {
    const palette = facePalette(DEFAULT_AVATAR, 'white');
    for (const { map } of faces) {
      for (const char of new Set(map.join(''))) {
        expect(char === '.' || char in palette, `letra ${char}`).toBe(true);
      }
    }
  });

  it('tem olhos (dois pontos de contorno no meio do rosto)', () => {
    const eyeRow = faceMap({ ...DEFAULT_AVATAR, hair: 'SHORT' })[4]!;
    expect(eyeRow.match(/K/g)).toHaveLength(4); // 2 de contorno e 2 olhos
  });
});

describe('cores do bonequinho', () => {
  it('toda pele e todo cabelo vêm de um token, nunca de hex solto', () => {
    for (const skin of AVATAR_SKINS) {
      for (const hairColor of AVATAR_HAIR_COLORS) {
        const { s, h, o } = avatarPalette({ skin, hair: 'SHORT', hairColor });
        for (const color of [s, h, o]) expect(color).toMatch(/^var\(--color-(skin|hair)-/);
      }
    }
  });

  it('as cinco peles são cinco tokens diferentes', () => {
    const skins = AVATAR_SKINS.map((skin) => avatarPalette({ ...DEFAULT_AVATAR, skin }).s);
    expect(new Set(skins).size).toBe(AVATAR_SKINS.length);
  });

  it('a camisa do time entra na paleta do corpo e do rosto', () => {
    expect(playerPalette(DEFAULT_AVATAR, 'white').T).toBe('#FFFFFF');
    expect(facePalette(DEFAULT_AVATAR, 'black').T).toBe('#2E2E2E');
    expect(facePalette(DEFAULT_AVATAR, null).T).toBe('var(--color-surface-3)');
  });
});

describe('contorno do cabelo preto na pele mais escura', () => {
  const dark = { skin: 'DARK', hair: 'SHORT', hairColor: 'BLACK' } as const;

  it('só preto sobre a pele mais escura (e com cabelo) ganha o contorno', () => {
    expect(needsRim(dark)).toBe(true);
    expect(needsRim({ ...dark, skin: 'BROWN' })).toBe(false);
    expect(needsRim({ ...dark, hairColor: 'BROWN' })).toBe(false);
    expect(needsRim({ ...dark, hair: 'BALD' })).toBe(false);
  });

  it('marca só o cabelo que encosta na pele, com um tom mais claro', () => {
    const map = playerSpriteMap(dark);
    expect(map.join('')).toContain('o');
    expect(avatarPalette(dark).o).toBe('var(--color-hair-black-rim)');
    expect(avatarPalette({ ...dark, skin: 'LIGHT' }).o).toBe('var(--color-hair-black)');
    expect(markHairRim(['hs', 'hh'])).toEqual(['os', 'ho']);
  });

  it('sem precisar do contorno, o mapa fica como está', () => {
    expect(playerSpriteMap(DEFAULT_AVATAR)).toEqual(bodySprite(DEFAULT_AVATAR.hair));
  });
});

describe('ícones das reações (12 x 12)', () => {
  const names = Object.keys(REACTION_SPRITES) as (keyof typeof REACTION_SPRITES)[];

  it('são as 5 reações da lista fechada', () => {
    expect(names.sort()).toEqual(['BALL', 'CLAP', 'FIRE', 'FLOP', 'LAUGH']);
  });

  it.each(names)('%s tem 12 linhas de 12 colunas e só letras da própria paleta', (name) => {
    const map = REACTION_SPRITES[name];
    expect(map).toHaveLength(REACTION_SPRITE_SIZE);
    expect(map.every((row) => row.length === REACTION_SPRITE_SIZE)).toBe(true);
    const palette = REACTION_PALETTES[name] as Record<string, string>;
    const letters = new Set(map.join('').replaceAll('.', ''));
    for (const letter of letters) expect(palette[letter], `${name}: ${letter}`).toBeDefined();
  });
});
