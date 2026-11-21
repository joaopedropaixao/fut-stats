import type { SpriteMap } from '../../components/ui/pixel-sprite-maps';

/**
 * Pixel art da moldura "Lenda" do Craque: uma letra por cor, `.` é vazio. K contorno, W brilho, Y ouro claro, G ouro,
 * D ouro escuro. Grade em TS e `<path>` com `crispEdges`, sem imagem. O Compartilhar (canvas) desenha as mesmas grades.
 */
export const LEGEND_PALETTE = {
  K: '#111111',
  W: 'color-mix(in srgb, var(--color-gold-light) 45%, white)',
  Y: 'var(--color-gold-light)',
  G: 'var(--color-gold)',
  D: 'var(--color-gold-shadow)',
};

/** O troféu (16 x 18): taça com alças, haste e base. */
export const TROPHY: SpriteMap = [
  '..KKKKKKKKKKKK..',
  'KKKYYYYYYYYGGKKK',
  'KYKYWWYGGGGGDKYK',
  'KYKYWYGGGGGGDKYK',
  'KYKYWYGGGGGGDKYK',
  '.KKYWYGGGGGGDKK.',
  '..KYWYGGGGGGDK..',
  '...KYYGGGGGDDK..',
  '....KYGGGGGDK...',
  '.....KKGGGDKK...',
  '......KKGDKK....',
  '.......KGDK.....',
  '.......KGDK.....',
  '......KKGDKK....',
  '.....KYYGGDDK...',
  '....KKKKKKKKKK..',
  '....KDDDDDDDDK..',
  '....KKKKKKKKKK..',
];

/** A faísca (5 x 5): cruz de luz, sem contorno, para pairar em volta. */
export const SPARK: SpriteMap = ['..W..', '..W..', 'WWYWW', '..W..', '..W..'];

/** A asa (14 x 9) virada para a esquerda; a da direita espelha. */
export const WING: SpriteMap = [
  'KK............',
  'KYKK..........',
  'KWYYKK........',
  '.KWYYYKK......',
  '.KYWYYYYKK....',
  '..KYYGGGGGKK..',
  '..KKYGGGDDDKK.',
  '....KKGDDDDDK.',
  '......KKKKKKK.',
];

/** A ponteira (7 x 8) que sobe do canto de cima da moldura. */
export const SPIKE: SpriteMap = [
  '...K...',
  '..KYK..',
  '..KWK..',
  '.KYGDK.',
  '.KYGDK.',
  'KYGGDDK',
  'KYGGDDK',
  'KKKKKKK',
];
