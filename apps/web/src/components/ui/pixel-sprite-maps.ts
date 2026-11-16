/**
 * Sprites em pixel da folha (docs/design/folha/build.py): mapas de caracteres, uma letra por cor.
 * `spritePaths` junta os pixels vizinhos da mesma cor num retângulo só (como o `rle_paths` da folha).
 */

import type { PlayerAvatar, PostReaction } from '@fut-stats/shared';
import { DEFAULT_AVATAR, type AvatarHair } from '../../lib/avatar';

/** Mapa de pixels: uma letra por cor, `.` é vazio. */
export type SpriteMap = readonly string[];

export const SPRITE_PLAYER_WIDTH = 8;
export const SPRITE_PLAYER_HEIGHT = 12;

/**
 * O bonequinho dos grandes momentos (8x12). Letras: `h` cabelo, `s` pele, `e` olho, `T` camisa, `k` calção,
 * `b` chuteira. O estilo do cabelo troca as linhas de cima (cabeça, e no cabelo comprido também o ombro);
 * o resto do corpo é o da folha.
 */
const HEAD: Record<AvatarHair, readonly string[]> = {
  BALD: ['..ssss..', '.ssssss.', '.sesses.', '...ss...', '.TTTTTT.'],
  SHORT: ['..hhhh..', '.hssssh.', '.sesses.', '...ss...', '.TTTTTT.'],
  CURLY: ['.h.hh.h.', '.hhhhhh.', 'hsessesh', '...ss...', '.TTTTTT.'],
  AFRO: ['.hhhhhh.', 'hhhhhhhh', 'hsessesh', '...ss...', '.TTTTTT.'],
  LONG: ['..hhhh..', '.hhhhhh.', 'hsessesh', 'h..ss..h', 'hTTTTTTh'],
  MOHAWK: ['...hh...', '.sshhss.', '.sesses.', '...ss...', '.TTTTTT.'],
};

const BODY_BELOW = [
  'sTTTTTTs',
  'sTTTTTTs',
  '..TTTT..',
  '..kkkk..',
  '..s..s..',
  '..s..s..',
  '.bb..bb.',
] as const;

/** O mapa do corpo para um estilo de cabelo. */
export function bodySprite(hair: AvatarHair): SpriteMap {
  return [...HEAD[hair], ...BODY_BELOW];
}

/** O bonequinho padrão (o `DEFAULT_AVATAR`). */
export const PLAYER_SPRITE = bodySprite(DEFAULT_AVATAR.hair);

export type SpriteTeam = 'white' | 'black';

/** Camisa do time; sem time, uma camisa neutra (cor de giz, calção e chuteira escuros). */
export function shirtColors(team: SpriteTeam | null): { T: string; k: string; b: string } {
  if (team === null)
    return { T: 'var(--color-text-muted)', k: 'var(--color-track)', b: 'var(--color-track)' };
  const white = team === 'white';
  return {
    T: white ? '#FFFFFF' : '#2E2E2E',
    k: white ? '#1B1B1B' : '#FFFFFF',
    b: white ? '#111111' : '#555555',
  };
}

/** A cor (token) de cada tom de pele e de cada cor de cabelo, para amostras e paletas. */
export const SKIN_VAR = {
  LIGHT: 'var(--color-skin-1)',
  FAIR: 'var(--color-skin-2)',
  TAN: 'var(--color-skin-3)',
  BROWN: 'var(--color-skin-4)',
  DARK: 'var(--color-skin-5)',
} as const satisfies Record<PlayerAvatar['skin'], string>;

export const HAIR_VAR = {
  BLACK: 'var(--color-hair-black)',
  BROWN: 'var(--color-hair-brown)',
  BLOND: 'var(--color-hair-blond)',
  RED: 'var(--color-hair-red)',
  GRAY: 'var(--color-hair-gray)',
} as const satisfies Record<PlayerAvatar['hairColor'], string>;

/** O segundo tom do cabelo (a sombra na borda de baixo): dá volume e deixa a cor legível com poucos blocos. */
export const HAIR_SHADE_VAR = {
  BLACK: 'var(--color-hair-black-shade)',
  BROWN: 'var(--color-hair-brown-shade)',
  BLOND: 'var(--color-hair-blond-shade)',
  RED: 'var(--color-hair-red-shade)',
  GRAY: 'var(--color-hair-gray-shade)',
} as const satisfies Record<PlayerAvatar['hairColor'], string>;

/** Preto sobre a pele mais escura some: a borda do cabelo ganha um tom mais claro (1 px). */
export function needsRim(avatar: PlayerAvatar): boolean {
  return avatar.hair !== 'BALD' && avatar.hairColor === 'BLACK' && avatar.skin === 'DARK';
}

/**
 * Pele e cabelo do bonequinho (`s`, `h` = cabelo, `H` = sombra do cabelo, `o` = o pixel de cabelo que encosta
 * na pele). Careca ignora a cor do cabelo.
 */
export function avatarPalette(avatar: PlayerAvatar): Record<string, string> {
  const hair = HAIR_VAR[avatar.hairColor];
  return {
    s: SKIN_VAR[avatar.skin],
    h: hair,
    H: HAIR_SHADE_VAR[avatar.hairColor],
    o: needsRim(avatar) ? 'var(--color-hair-black-rim)' : hair,
    e: 'var(--color-outline)',
  };
}

/**
 * Dá volume ao cabelo: o pixel de cabelo (`h`) que não tem mais cabelo logo abaixo vira `H` (a sombra), então a
 * borda de baixo de cada mecha fica no segundo tom.
 */
export function shadeHair(map: SpriteMap): SpriteMap {
  const below = (x: number, y: number) => map[y + 1]?.[x];
  return map.map((line, y) =>
    [...line]
      .map((c, x) => (c === 'h' && below(x, y) !== 'h' && below(x, y) !== 'H' ? 'H' : c))
      .join(''),
  );
}

/** Marca com `o` o cabelo (`h` ou a sombra `H`) que encosta na pele (acima, abaixo, esquerda ou direita). */
export function markHairRim(map: SpriteMap): SpriteMap {
  const at = (x: number, y: number) => map[y]?.[x];
  return map.map((line, y) =>
    [...line]
      .map((c, x) =>
        (c === 'h' || c === 'H') &&
        [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)].includes('s')
          ? 'o'
          : c,
      )
      .join(''),
  );
}

/** Paleta completa do corpo: pele, cabelo, olho e a camisa do time. */
export function playerPalette(
  avatar: PlayerAvatar,
  team: SpriteTeam | null,
): Record<string, string> {
  return { ...avatarPalette(avatar), ...shirtColors(team) };
}

/** Mapa do corpo já com a marcação do contorno (só quando o preto precisa dele). */
export function playerSpriteMap(avatar: PlayerAvatar): SpriteMap {
  const map = bodySprite(avatar.hair);
  return needsRim(avatar) ? markHairRim(map) : map;
}

/** Caminhos SVG por cor: `{ cor: 'M0 0h2v1h-2z...' }`. Letra fora da paleta (e `.`) fica vazia. */
export function spritePaths(
  map: readonly string[],
  palette: Record<string, string>,
): Record<string, string> {
  const byColor: Record<string, string> = {};
  map.forEach((line, y) => {
    let x = 0;
    while (x < line.length) {
      const key = line[x]!;
      const color = palette[key];
      if (!color) {
        x += 1;
        continue;
      }
      let end = x;
      while (end < line.length && line[end] === key) end += 1;
      byColor[color] = `${byColor[color] ?? ''}M${x} ${y}h${end - x}v1h-${end - x}z`;
      x = end;
    }
  });
  return byColor;
}

/** Os ícones das reações das resenhas (12x12). Uma letra por cor; `.` é vazio; `K` é o contorno escuro. */
export const REACTION_SPRITE_SIZE = 12;

export const REACTION_SPRITES = {
  // Bola: gomos escuros no branco, com contorno
  BALL: [
    '...KKKKKK...',
    '..KWWKKWWK..',
    '.KWWKKKKWWK.',
    'KWWWWKKWWWWK',
    'KWKWWWWWWKWK',
    'KKKKWWWWKKKK',
    'KKKKWWWWKKKK',
    'KWKWWWWWWKWK',
    'KWWWWKKWWWWK',
    '.KWWKKKKWWK.',
    '..KWWKKWWK..',
    '...KKKKKK...',
  ],
  // Fogo: chama laranja com miolo claro
  FIRE: [
    '.....R......',
    '....RR......',
    '....RRR..R..',
    '...RRRR.RR..',
    '..RRRYRRRR..',
    '..RRYYYRRRR.',
    '.RRRYYYYRRR.',
    '.RRYYYYYYRR.',
    '.RRYYWWYYRR.',
    '..RRYWWYRR..',
    '...RRYYRR...',
    '....RRRR....',
  ],
  // Risada: rosto com os olhos fechados e a boca aberta
  LAUGH: [
    '....YYYY....',
    '..YYYYYYYY..',
    '.YYYYYYYYYY.',
    '.YKKYYYYKKY.',
    'YYYYYYYYYYYY',
    'YKKKKKKKKKKY',
    'YKWWWWWWWWKY',
    '.KWRRRRRRWK.',
    '.YKKRRRRKKY.',
    '.YYYKKKKYYY.',
    '..YYYYYYYY..',
    '....YYYY....',
  ],
  // Palmas: as duas mãos de frente uma para a outra, os dedos separados, e as faíscas de cima
  CLAP: [
    '..Y..YY..Y..',
    '...Y.YY.Y...',
    '.SSSS..SSSS.',
    '.SKSS..SSKS.',
    '.SKSS..SSKS.',
    '.SSSSKKSSSS.',
    '.SSSSKKSSSS.',
    '..SSSSSSSS..',
    '..SSSSSSSS..',
    '...SSSSSS...',
    '...SSSSSS...',
    '....SSSS....',
  ],
  // Perna de pau: a perna dentro da bota, em cima de uma vara de madeira
  FLOP: [
    '...SSSS.....',
    '...SSSS.....',
    '...WWWW.....',
    '...WWWW.....',
    '...WWWWWWW..',
    '...KKKKKKK..',
    '....BB......',
    '....BB......',
    '....BB......',
    '....BB......',
    '....BB......',
    '....KK......',
  ],
} as const satisfies Record<PostReaction, SpriteMap>;

/** As cores de cada ícone de reação (tokens do DS; o amarelo de ação fica de fora, o ouro claro faz o rosto). */
export const REACTION_PALETTES = {
  BALL: { K: '#111111', W: 'var(--color-text)' },
  FIRE: {
    R: 'var(--color-warning)',
    Y: 'var(--color-gold-light)',
    W: 'var(--color-text)',
  },
  LAUGH: {
    K: '#111111',
    Y: 'var(--color-gold-light)',
    W: 'var(--color-text)',
    R: 'var(--color-danger)',
  },
  CLAP: {
    K: '#111111',
    S: 'var(--color-skin-3)',
    D: 'var(--color-skin-4)',
    Y: 'var(--color-gold-light)',
  },
  FLOP: { B: 'var(--color-flop)', W: 'var(--color-text)', K: '#111111', S: 'var(--color-skin-3)' },
} as const satisfies Record<PostReaction, Record<string, string>>;
