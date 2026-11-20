import type { SpriteMap } from '../../components/ui/pixel-sprite-maps';

/**
 * Pixel art das molduras do Craque (só dev, para o dono escolher): uma letra por cor, `.` é vazio.
 * K contorno, W brilho, Y ouro claro, G ouro, D ouro escuro. Sem imagem: grade em TS e `<path>` com `crispEdges`.
 */
export const GOLD = {
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

/** A cantoneira em L com rebite (8 x 8), para o canto de cima à esquerda; os outros espelham. */
export const CORNER: SpriteMap = [
  'KKKKKKKK',
  'KWYYYYGK',
  'KYGGGDDK',
  'KYGKKDK.',
  'KYGKDK..',
  'KYDDK...',
  'KGDK....',
  'KKK.....',
];

/** A estrela de borda (9 x 9), com contorno. */
export const STAR: SpriteMap = [
  '....K....',
  '...KYK...',
  '...KYK...',
  'KKKKYKKKK',
  'KYYYWYYYK',
  '.KYWWWYK.',
  '..KYWYK..',
  '.KYKKKYK.',
  'KKK...KKK',
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
