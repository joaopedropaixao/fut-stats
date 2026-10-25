/**
 * Sprites em pixel da folha (docs/design/folha/build.py): mapas de caracteres, uma letra por cor.
 * `spritePaths` junta os pixels vizinhos da mesma cor num retângulo só (como o `rle_paths` da folha).
 */

/** O bonequinho dos grandes momentos (8x12). */
export const PLAYER_SPRITE = [
  '..hhhh..',
  '..hsss..',
  '..ssss..',
  '...ss...',
  '.TTTTTT.',
  'sTTTTTTs',
  'sTTTTTTs',
  '..TTTT..',
  '..kkkk..',
  '..s..s..',
  '..s..s..',
  '.bb..bb.',
] as const;

export const SPRITE_PLAYER_WIDTH = 8;
export const SPRITE_PLAYER_HEIGHT = 12;

export type SpriteTeam = 'white' | 'black';

/** Paleta do bonequinho por time (camisa, calção e chuteira mudam; pele e cabelo não). */
export function teamPalette(team: SpriteTeam): Record<string, string> {
  const white = team === 'white';
  return {
    h: '#3A2414',
    s: '#D9A07A',
    T: white ? '#FFFFFF' : '#2E2E2E',
    k: white ? '#1B1B1B' : '#FFFFFF',
    b: white ? '#111111' : '#555555',
  };
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
