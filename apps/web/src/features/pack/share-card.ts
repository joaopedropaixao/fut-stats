import { POSITION_LABELS, TEAM_LABELS } from '@fut-stats/shared';
import { bodyLargeMap, bodyLargePalette } from '../../components/ui/pixel-body-large-maps';
import { pixelDigitsPath } from '../../components/ui/pixel-glyphs';
import { formatRating } from '../../lib/rating-format';
import type { PackCard } from './deck';
import { TIER_COLORS, TIER_LABELS } from './tier';

/** A imagem do Compartilhar: 1080 x 1350, a carta inteira no mesmo desenho pixel (4 px de tela por unidade). */
export const SHARE_WIDTH = 1080;
export const SHARE_HEIGHT = 1350;

/** A carta em unidades de CSS (176 x 280), ampliada 4x no canvas. */
const CARD_W = 176;
const CARD_H = 280;

const STAR_PATH = 'M12 2l3 6.9 7.5.7-5.7 5 1.7 7.4L12 18l-6.5 4 1.7-7.4-5.7-5 7.5-.7z';

/** Resolve `var(--token)` para a cor de verdade (o canvas não lê variável de CSS). */
function resolveColor(value: string): string {
  const match = /^var\((--[\w-]+)\)$/.exec(value);
  if (!match) return value;
  return getComputedStyle(document.documentElement).getPropertyValue(match[1]!).trim() || '#ffffff';
}

function text(
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

/** Desenha a carta (a mesma da tela) e devolve o PNG. */
export async function renderCardPng(card: PackCard, roundNumber: number): Promise<Blob> {
  // A fonte pixel precisa estar carregada antes de desenhar o texto
  try {
    await document.fonts.load('700 16px Silkscreen');
    await document.fonts.ready;
  } catch {
    // sem a fonte, o canvas usa a reserva (monoespaçada)
  }
  const canvas = document.createElement('canvas');
  canvas.width = SHARE_WIDTH;
  canvas.height = SHARE_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas indisponível');
  ctx.imageSmoothingEnabled = false;

  // Fundo: o gramado à noite com o holofote
  const bg = ctx.createLinearGradient(0, 0, 0, SHARE_HEIGHT);
  bg.addColorStop(0, resolveColor('var(--color-surface-raised)'));
  bg.addColorStop(1, resolveColor('var(--color-bg)'));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, SHARE_WIDTH, SHARE_HEIGHT);
  const glow = ctx.createRadialGradient(540, 560, 40, 540, 560, 620);
  glow.addColorStop(0, 'rgba(232,169,58,0.35)');
  glow.addColorStop(1, 'rgba(232,169,58,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, SHARE_WIDTH, SHARE_HEIGHT);

  // A carta, centrada e ampliada 4x (um pouco maior: 5x ocuparia 880 x 1400)
  const scale = 4.4;
  const ox = Math.round((SHARE_WIDTH - CARD_W * scale) / 2);
  const oy = 70;
  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);
  drawCard(ctx, card, roundNumber);
  ctx.restore();

  // Rodapé
  text(ctx, 'Fut Stats', SHARE_WIDTH / 2, 1290, {
    size: 40,
    color: resolveColor('var(--color-text)'),
    align: 'center',
  });

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('sem imagem'))), 'image/png'),
  );
}

function drawCard(ctx: CanvasRenderingContext2D, card: PackCard, roundNumber: number) {
  const tier = TIER_COLORS[card.tier];
  const { player } = card;
  // Sombra dura e fundo da faixa
  ctx.fillStyle = '#000';
  ctx.fillRect(6, 6, CARD_W, CARD_H);
  const grad = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
  grad.addColorStop(0, tier.from);
  grad.addColorStop(0.3, tier.mid);
  grad.addColorStop(0.55, tier.to);
  grad.addColorStop(1, tier.mid);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  // Moldura preta de 3
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, CARD_W - 3, CARD_H - 3);

  // Tira do time
  const white = player.team === 'WHITE';
  ctx.fillStyle = white ? '#fff' : '#000';
  ctx.fillRect(3, 3, CARD_W - 6, 36);
  ctx.fillStyle = white ? '#000' : 'rgba(255,255,255,0.35)';
  ctx.fillRect(3, 36, CARD_W - 6, 3);
  text(ctx, TEAM_LABELS[player.team], 16, 14, { color: white ? '#000' : '#fff' });
  if (card.you) {
    ctx.fillStyle = resolveColor('var(--color-text)');
    ctx.fillRect(CARD_W - 64, 10, 52, 20);
    text(ctx, 'Você', CARD_W - 38, 12, { color: '#000', align: 'center' });
  }

  // Nota em dígitos pixel (escala 4)
  const { d } = pixelDigitsPath(formatRating(card.score));
  ctx.save();
  ctx.translate(12, 48);
  ctx.scale(4, 4);
  ctx.fillStyle = tier.ink;
  ctx.fill(new Path2D(d));
  ctx.restore();
  text(ctx, POSITION_LABELS[player.position], 12, 88, { color: tier.ink });

  // Estrela e faixa por extenso
  ctx.save();
  ctx.translate(CARD_W - 12 - 22, 48);
  ctx.scale(22 / 24, 22 / 24);
  ctx.fillStyle = tier.ink;
  ctx.fill(new Path2D(STAR_PATH));
  ctx.restore();
  text(ctx, TIER_LABELS[card.tier], CARD_W - 12, 74, { color: tier.ink, align: 'right' });

  // O bonequinho grande (16 x 24 na escala 3)
  const map = bodyLargeMap(player.avatar);
  const palette = bodyLargePalette(player.avatar, white ? 'white' : 'black');
  const bx = Math.round((CARD_W - 16 * 3) / 2);
  const by = 114;
  map.forEach((line, y) =>
    [...line].forEach((c, x) => {
      const color = palette[c];
      if (!color) return;
      ctx.fillStyle = resolveColor(color);
      ctx.fillRect(bx + x * 3, by + y * 3, 3, 3);
    }),
  );

  // Nomes: o apelido inteiro (encolhe na largura se precisar), o tipo da carta e a nota
  const kind =
    card.kind === 'mine' ? 'Sua carta' : card.kind === 'flop' ? 'Perna de pau' : 'Craque';
  const note =
    card.kind === 'mine'
      ? card.rank !== null
        ? `#${card.rank} na rodada`
        : ''
      : `Rodada ${roundNumber}`;
  text(ctx, player.nickname, 12, 200, { color: tier.ink, maxWidth: CARD_W - 24 });
  text(ctx, kind, 12, 222, { color: '#3a2a10', maxWidth: CARD_W - 24 });
  text(ctx, note, 12, 244, { color: '#3a2a10', maxWidth: CARD_W - 24 });
}
