import { POSITION_LABELS, TEAM_LABELS } from '@fut-stats/shared';
import { bodyLargeMap, bodyLargePalette } from '../../components/ui/pixel-body-large-maps';
import { pixelDigitsPath } from '../../components/ui/pixel-glyphs';
import { formatRating } from '../../lib/rating-format';
import type { PackCard } from './deck';
import { TIER_LABELS } from './tier';

/** A carta em unidades de CSS (192 x 288), ampliada 4x no canvas. */
export const CARD_W = 192;
export const CARD_H = 288;

const STAR_PATH = 'M12 2l3 6.9 7.5.7-5.7 5 1.7 7.4L12 18l-6.5 4 1.7-7.4-5.7-5 7.5-.7z';

/** Resolve `var(--token)` para a cor de verdade (o canvas não lê variável de CSS). */
export function resolveColor(value: string): string {
  const match = /^var\((--[\w-]+)\)$/.exec(value);
  if (!match) return value;
  return getComputedStyle(document.documentElement).getPropertyValue(match[1]!).trim() || '#ffffff';
}

export function text(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  opts: { size?: number; color: string; align?: CanvasTextAlign; maxWidth?: number },
) {
  const size = opts.size ?? 16;
  ctx.font = `700 ${size}px Silkscreen, monospace`;
  ctx.fillStyle = opts.color;
  ctx.textAlign = opts.align ?? 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(value.toUpperCase(), x, y, opts.maxWidth);
}

export type ContentOptions = {
  /** Largura do miolo da carta (192 na carta comum, 200 na moldura Lenda). */
  faceW: number;
  ink: string;
  ink2: string;
  /** Estrela e a faixa por extenso no canto (as cartas comuns); a Lenda tem o selo no lugar. */
  tierLabel: boolean;
  /** Sombra clara sob a nota (a Lenda: tinta escura sobre o ouro). */
  emboss?: boolean;
};

/** O que vai dentro da carta, do miolo para dentro: tira do time, nota, posição, bonequinho, números e nomes. */
export function drawCardContent(
  ctx: CanvasRenderingContext2D,
  card: PackCard,
  roundNumber: number,
  o: ContentOptions,
) {
  const { player } = card;
  const W = o.faceW;
  // Tira do time
  const white = player.team === 'WHITE';
  ctx.fillStyle = white ? '#fff' : '#000';
  ctx.fillRect(3, 3, W - 6, 36);
  ctx.fillStyle = white ? '#000' : 'rgba(255,255,255,0.35)';
  ctx.fillRect(3, 36, W - 6, 3);
  text(ctx, TEAM_LABELS[player.team], 16, 14, { color: white ? '#000' : '#fff' });
  if (card.you) {
    // O selo VOCÊ: fundo escuro, letras claras, contorno grosso e sombra dura (legível em qualquer faixa). Inteiro,
    // com a sombra, dentro da tira do time e com a mesma margem do nome (13 de cada lado da tira, que vai de 3 a 189).
    // A altura vem da medida real do texto (o acento do Ê incluído): 2,5 unidades (10 px do canvas) de folga entre o
    // topo do acento e o miolo, e a mesma folga embaixo das letras.
    const label = 'VOCÊ';
    ctx.font = '700 16px Silkscreen, monospace';
    // a medida vale para a linha de base alfabética (a mesma com que o texto é desenhado depois)
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'center';
    const m = ctx.measureText(label);
    const gap = 2.5;
    const sw = 64;
    const inner = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent + gap * 2;
    const sh = Math.ceil(inner) + 6;
    const sx = W - 3 - 13 - 3 - sw;
    const sy = 3 + Math.floor((33 - (sh + 3)) / 2);
    ctx.fillStyle = '#000';
    ctx.fillRect(sx + 3, sy + 3, sw, sh);
    ctx.fillStyle = resolveColor('var(--color-text)');
    ctx.fillRect(sx, sy, sw, sh);
    ctx.fillStyle = '#000';
    ctx.fillRect(sx + 3, sy + 3, sw - 6, sh - 6);
    ctx.fillStyle = resolveColor('var(--color-text)');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(label, sx + sw / 2, sy + 3 + gap + m.actualBoundingBoxAscent, sw - 12);
  }

  // Nota em dígitos pixel (escala 4)
  const { d } = pixelDigitsPath(formatRating(card.score));
  if (o.emboss) {
    ctx.save();
    ctx.translate(14, 50);
    ctx.scale(4, 4);
    ctx.fillStyle = 'rgba(255,238,170,0.6)';
    ctx.fill(new Path2D(d));
    ctx.restore();
  }
  ctx.save();
  ctx.translate(12, 48);
  ctx.scale(4, 4);
  ctx.fillStyle = o.ink;
  ctx.fill(new Path2D(d));
  ctx.restore();
  text(ctx, POSITION_LABELS[player.position], 12, 88, { color: o.ink });

  // Estrela e faixa por extenso (na moldura Lenda a faixa vira o selo, desenhado por quem chama)
  if (o.tierLabel) {
    ctx.save();
    ctx.translate(W - 12 - 22, 48);
    ctx.scale(22 / 24, 22 / 24);
    ctx.fillStyle = o.ink;
    ctx.fill(new Path2D(STAR_PATH));
    ctx.restore();
    text(ctx, TIER_LABELS[card.tier], W - 12, 74, { color: o.ink, align: 'right' });
  }

  // O bonequinho grande (16 x 24 na escala 3); com números (o Craque), as etiquetas ficam à esquerda dele
  const map = bodyLargeMap(player.avatar);
  const palette = bodyLargePalette(player.avatar, white ? 'white' : 'black');
  const hasStats = card.kind === 'craque';
  const bx = hasStats ? W - 12 - 16 * 3 : Math.round((W - 16 * 3) / 2);
  const by = 118;
  map.forEach((line, y) =>
    [...line].forEach((c, x) => {
      const color = palette[c];
      if (!color) return;
      ctx.fillStyle = resolveColor(color);
      ctx.fillRect(bx + x * 3, by + y * 3, 3, 3);
    }),
  );
  if (hasStats) {
    const { goals, assists } = player;
    [`${goals} ${goals === 1 ? 'gol' : 'gols'}`, `${assists} assist.`].forEach((label, i) => {
      const cy = 124 + i * 30;
      ctx.font = '700 14px Silkscreen, monospace';
      const cw = Math.ceil(ctx.measureText(label.toUpperCase()).width) + 14;
      ctx.fillStyle = o.ink;
      ctx.fillRect(12, cy, cw, 24);
      text(ctx, label, 19, cy + 5, { size: 14, color: '#fff' });
    });
  }

  // Nomes: o apelido inteiro (encolhe na largura se precisar), o tipo da carta e a nota
  const kind =
    card.kind === 'mine' ? 'Sua carta' : card.kind === 'flop' ? 'Perna de pau' : 'Craque';
  const note =
    card.kind === 'mine'
      ? card.rank !== null
        ? `Posição ${card.rank}`
        : ''
      : `Rodada ${roundNumber}`;
  text(ctx, player.nickname, 12, 208, { color: o.ink, maxWidth: W - 24 });
  text(ctx, kind, 12, 230, { color: o.ink2, maxWidth: W - 24 });
  text(ctx, note, 12, 252, { color: o.ink2, maxWidth: W - 24 });
}
