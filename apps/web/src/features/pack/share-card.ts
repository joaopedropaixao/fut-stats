import { POSITION_LABELS, TEAM_LABELS } from '@fut-stats/shared';
import { bodyLargeMap, bodyLargePalette } from '../../components/ui/pixel-body-large-maps';
import { pixelDigitsPath } from '../../components/ui/pixel-glyphs';
import { formatRating } from '../../lib/rating-format';
import type { PackCard } from './deck';
import { TIER_COLORS, TIER_LABELS } from './tier';

/** A imagem do Compartilhar: 1080 x 1350, a carta inteira no mesmo desenho pixel (4 px de tela por unidade). */
export const SHARE_WIDTH = 1080;
export const SHARE_HEIGHT = 1350;

/** A carta em unidades de CSS (192 x 288), ampliada 4x no canvas. */
const CARD_W = 192;
const CARD_H = 288;

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

  drawStage(ctx);

  // A carta, centrada e ampliada 4x (inteiro: o pixel art não pode ficar fracionado). Com frase (o Craque), a marca
  // vai para o alto e a frase assina a carta embaixo; sem frase, o rodapé fica como era.
  const scale = 4;
  const ox = Math.round((SHARE_WIDTH - CARD_W * scale) / 2);
  const withPhrase = card.phrase !== null;
  const oy = withPhrase ? 48 : 74;
  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);
  drawCard(ctx, card, roundNumber);
  ctx.restore();

  if (withPhrase) {
    text(ctx, 'Fut Stats', SHARE_WIDTH / 2, 10, {
      size: 28,
      color: resolveColor('var(--color-text)'),
      align: 'center',
    });
    drawPhrase(ctx, card.phrase!);
  } else {
    text(ctx, 'Fut Stats', SHARE_WIDTH / 2, 1268, {
      size: 40,
      color: resolveColor('var(--color-text)'),
      align: 'center',
    });
  }

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('sem imagem'))), 'image/png'),
  );
}

/** O palco do Compartilhar: gramado à noite, cone do holofote sobre a carta e o padrão pixel discreto. */
function drawStage(ctx: CanvasRenderingContext2D) {
  const bg = ctx.createLinearGradient(0, 0, 0, SHARE_HEIGHT);
  bg.addColorStop(0, '#0a2113');
  bg.addColorStop(0.6, resolveColor('var(--color-surface-raised)'));
  bg.addColorStop(1, resolveColor('var(--color-surface-3)'));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, SHARE_WIDTH, SHARE_HEIGHT);
  // o cone de luz, do alto até a carta
  const cone = ctx.createLinearGradient(0, 0, 0, 900);
  cone.addColorStop(0, 'rgba(255,244,200,0.22)');
  cone.addColorStop(1, 'rgba(255,244,200,0)');
  ctx.fillStyle = cone;
  ctx.beginPath();
  ctx.moveTo(SHARE_WIDTH * 0.4, 0);
  ctx.lineTo(SHARE_WIDTH * 0.6, 0);
  ctx.lineTo(SHARE_WIDTH, 900);
  ctx.lineTo(0, 900);
  ctx.closePath();
  ctx.fill();
  const glow = ctx.createRadialGradient(540, 560, 40, 540, 560, 620);
  glow.addColorStop(0, 'rgba(255,238,176,0.34)');
  glow.addColorStop(0.6, 'rgba(232,169,58,0.14)');
  glow.addColorStop(1, 'rgba(232,169,58,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, SHARE_WIDTH, SHARE_HEIGHT);
  // o tabuleiro de quadradinhos de 16 px, quase invisível
  ctx.fillStyle = 'rgba(255,255,255,0.035)';
  for (let y = 0; y < SHARE_HEIGHT; y += 16) {
    for (let x = (y / 16) % 2 === 0 ? 0 : 16; x < SHARE_WIDTH; x += 32) ctx.fillRect(x, y, 16, 16);
  }
}

/**
 * A frase de impacto: faixa escura com contorno de ouro e sombra dura, letras claras, em até duas linhas. Ancorada
 * embaixo, com 28 px de respiro até a borda da imagem (a sombra incluída), qualquer que seja o número de linhas.
 */
function drawPhrase(ctx: CanvasRenderingContext2D, phrase: string) {
  const x = 60;
  const w = SHARE_WIDTH - 120;
  const size = 32;
  const step = size + 6;
  const shadow = 8;
  ctx.font = `700 ${size}px Silkscreen, monospace`;
  const lines: string[] = [];
  let current = '';
  for (const word of phrase.toUpperCase().split(' ')) {
    const next = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(next).width > w - 48) {
      lines.push(current);
      current = word;
    } else current = next;
  }
  lines.push(current);
  const h = 28 + lines.length * step;
  const y = SHARE_HEIGHT - 28 - shadow - h;
  ctx.fillStyle = '#000';
  ctx.fillRect(x + shadow, y + shadow, w, h);
  ctx.fillStyle = resolveColor('var(--color-gold)');
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#000';
  ctx.fillRect(x + 8, y + 8, w - 16, h - 16);
  lines.forEach((line, i) =>
    text(ctx, line, SHARE_WIDTH / 2, y + 17 + i * step, {
      size,
      color: resolveColor('var(--color-text)'),
      align: 'center',
    }),
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
    // O selo VOCÊ: fundo escuro, letras claras, contorno grosso e sombra dura (legível em qualquer faixa). Inteiro,
    // com a sombra, dentro da tira do time e com a mesma margem do nome (13 de cada lado da tira, que vai de 3 a 189)
    const sw = 64;
    const sh = 27;
    const sx = CARD_W - 3 - 13 - 3 - sw;
    const sy = 4;
    ctx.fillStyle = '#000';
    ctx.fillRect(sx + 3, sy + 3, sw, sh);
    ctx.fillStyle = resolveColor('var(--color-text)');
    ctx.fillRect(sx, sy, sw, sh);
    ctx.fillStyle = '#000';
    ctx.fillRect(sx + 3, sy + 3, sw - 6, sh - 6);
    // o texto fica no meio do miolo: o acento do Ê tem folga em cima e embaixo do miolo sobra a mesma
    text(ctx, 'Você', sx + sw / 2, sy + 9, {
      color: resolveColor('var(--color-text)'),
      align: 'center',
    });
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

  // O bonequinho grande (16 x 24 na escala 3); com números (o Craque), as etiquetas ficam à esquerda dele
  const map = bodyLargeMap(player.avatar);
  const palette = bodyLargePalette(player.avatar, white ? 'white' : 'black');
  const hasStats = card.kind === 'craque';
  const bx = hasStats ? CARD_W - 12 - 16 * 3 : Math.round((CARD_W - 16 * 3) / 2);
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
      ctx.fillStyle = tier.ink;
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
  text(ctx, player.nickname, 12, 208, { color: tier.ink, maxWidth: CARD_W - 24 });
  text(ctx, kind, 12, 230, { color: tier.ink2, maxWidth: CARD_W - 24 });
  text(ctx, note, 12, 252, { color: tier.ink2, maxWidth: CARD_W - 24 });
}
