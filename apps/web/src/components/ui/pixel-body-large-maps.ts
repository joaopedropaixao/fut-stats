import type { PlayerAvatar } from '@fut-stats/shared';
import { FACE_TOP } from './pixel-face-maps';
import {
  avatarPalette,
  markHairRim,
  needsRim,
  shadeHair,
  shirtColors,
  type SpriteMap,
  type SpriteTeam,
} from './pixel-sprite-maps';

/** O corpo grande do bonequinho: 16 x 24, no traço do rosto 12 x 12 (contorno `K`, olhos de 1 px, cabelo em dois tons). */
export const BODY_LARGE_WIDTH = 16;
export const BODY_LARGE_HEIGHT = 24;

/** A cabeça do rosto 12 x 12 centrada nas 16 colunas (2 de folga de cada lado). */
const pad = (row: string) => `..${row}..`;

/**
 * As letras são as do rosto: `K` contorno e olho, `s` pele, `h` cabelo (a borda de baixo vira `H`, a sombra),
 * `T` camisa, `k` calção, `b` chuteira. A cabeça (8 linhas) é a do rosto; embaixo vêm pescoço, camisa com os
 * braços, calção, pernas e chuteiras. Só o cabelo comprido muda o tronco: os fios caem sobre o ombro.
 */
const CHIN = '....KKKK....';
const CHIN_LONG = '.KhhKKKKhhK.';

const TORSO_COMMON = [
  '......KssK......',
  '....KTTssTTK....',
  '..KKTTTTTTTTKK..',
  '.KTTTTTTTTTTTTK.',
] as const;

const TORSO_LONG = [
  '...KhhKssKhhK...',
  '..KhhKTssTKhhK..',
  '.KhhKTTTTTTKhhK.',
  'KhhKTTTTTTTTKhhK',
] as const;

const BODY_BELOW = [
  'KTTKTTTTTTTTKTTK',
  'KssKTTTTTTTTKssK',
  'KssKTTTTTTTTKssK',
  '.KKKTTTTTTTTKKK.',
  '...KTTTTTTTTK...',
  '...KkkkkkkkkK...',
  '...KkkkkkkkkK...',
  '...KkkkKKkkkK...',
  '...KsssKKsssK...',
  '...KsssKKsssK...',
  '...KsssKKsssK...',
  '..KbbbbKKbbbbK..',
] as const;

/** O mapa do corpo grande (24 linhas de 16 colunas) para o estilo de cabelo, já com a sombra do cabelo. */
export function bodyLargeMap(avatar: PlayerAvatar): SpriteMap {
  const long = avatar.hair === 'LONG';
  const map = shadeHair([
    ...FACE_TOP[avatar.hair].map(pad),
    pad(long ? CHIN_LONG : CHIN),
    ...(long ? TORSO_LONG : TORSO_COMMON),
    ...BODY_BELOW,
  ]);
  return needsRim(avatar) ? markHairRim(map) : map;
}

/** Paleta do corpo grande: a do rosto (pele, cabelo, sombra, contorno) mais a camisa, o calção e a chuteira. */
export function bodyLargePalette(
  avatar: PlayerAvatar,
  team: SpriteTeam | null,
): Record<string, string> {
  return { ...avatarPalette(avatar), K: 'var(--color-outline)', ...shirtColors(team) };
}
