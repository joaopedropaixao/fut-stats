import type { PlayerAvatar } from '@fut-stats/shared';
import type { AvatarHair } from '../../lib/avatar';
import {
  avatarPalette,
  markHairRim,
  needsRim,
  shadeHair,
  type SpriteMap,
  type SpriteTeam,
} from './pixel-sprite-maps';

/** O rosto do bonequinho: cabeça e ombros numa grade de 12 x 12, para caber dentro do avatar redondo. */
export const FACE_SIZE = 12;

/**
 * Letras: `K` contorno e olho (preto fixo da pixel art), `s` pele, `h` cabelo (a borda de baixo vira `H`, a sombra,
 * em `faceMap`), `T` camisa. As quatro últimas
 * linhas (queixo e ombros) são iguais em todo estilo; só o cabelo comprido deixa os fios caírem no ombro.
 * Cada estilo tem uma silhueta própria, para o olho reconhecer a 40 px: careca (cúpula lisa), curto (uma
 * franja), cacheado (cachos), black power (a maior), comprido (desce até o ombro) e moicano (a crista).
 */
export const FACE_TOP: Record<AvatarHair, readonly string[]> = {
  BALD: [
    '............',
    '...KKKKKK...',
    '..KssssssK..',
    '.KssssssssK.',
    '.KssKssKssK.',
    '.KssssssssK.',
    '..KssssssK..',
  ],
  SHORT: [
    '............',
    '...KKKKKK...',
    '..KhhhhhhK..',
    '.KhhsssshhK.',
    '.KhsKssKshK.',
    '.KssssssssK.',
    '..KssssssK..',
  ],
  CURLY: [
    '..KK.KK.KK..',
    '.KhhKhhKhhK.',
    'KhhhhhhhhhhK',
    'KhhhsssshhhK',
    'KhhsKssKshhK',
    '.KssssssssK.',
    '..KssssssK..',
  ],
  AFRO: [
    '...KKKKKK...',
    '..KhhhhhhK..',
    '.KhhhhhhhhK.',
    'KhhhhhhhhhhK',
    'KhhsKssKshhK',
    '.KhsssssshK.',
    '..KssssssK..',
  ],
  LONG: [
    '............',
    '...KKKKKK...',
    '..KhhhhhhK..',
    '.KhhhhhhhhK.',
    '.KhsKssKshK.',
    '.KhsssssshK.',
    '.KhKssssKhK.',
  ],
  MOHAWK: [
    '....KhhK....',
    '...KshhsK...',
    '..KsshhssK..',
    '.KssshhsssK.',
    '.KssKssKssK.',
    '.KssssssssK.',
    '..KssssssK..',
  ],
};

const FACE_BOTTOM_COMMON = [
  '....KKKK....',
  '..KTTssTTK..',
  '.KTTTTTTTTK.',
  'KTTTTTTTTTTK',
  'TTTTTTTTTTTT',
] as const;

const FACE_BOTTOM_LONG = [
  '.KhhKKKKhhK.',
  'KhKTTssTTKhK',
  '.KhTTTTTThK.',
  'KTTTTTTTTTTK',
  'TTTTTTTTTTTT',
] as const;

/** O mapa do rosto (12 linhas de 12 colunas) para um estilo de cabelo. */
export function faceMap(avatar: PlayerAvatar): SpriteMap {
  const map = shadeHair([
    ...FACE_TOP[avatar.hair],
    ...(avatar.hair === 'LONG' ? FACE_BOTTOM_LONG : FACE_BOTTOM_COMMON),
  ]);
  return needsRim(avatar) ? markHairRim(map) : map;
}

/** Paleta do rosto: pele, cabelo, contorno e a camisa do time (ou o tom neutro, sem time). */
export function facePalette(avatar: PlayerAvatar, team: SpriteTeam | null): Record<string, string> {
  const shirt = team === null ? 'var(--color-surface-3)' : team === 'white' ? '#FFFFFF' : '#2E2E2E';
  return { ...avatarPalette(avatar), K: 'var(--color-outline)', T: shirt };
}
