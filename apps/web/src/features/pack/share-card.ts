import type { PackCard } from './deck';
import { drawLegendCard, LEGEND_W } from './share-legend';
import { CARD_H, CARD_W, drawCardContent, resolveColor, text } from './share-draw';
import { TIER_COLORS } from './tier';

/** A imagem do Compartilhar: 1080 x 1350, a carta inteira no mesmo desenho pixel (4 px de tela por unidade). */
export const SHARE_WIDTH = 1080;
export const SHARE_HEIGHT = 1350;

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
  // O Craque (moldura Lenda, 240 x 370) é maior que a carta comum: ampliado 3x para caber com a frase embaixo.
  const legend = card.kind === 'craque';
  const scale = legend ? 3 : 4;
  const ox = Math.round((SHARE_WIDTH - (legend ? LEGEND_W : CARD_W) * scale) / 2);
  const withPhrase = card.phrase !== null;
  const oy = legend ? 46 : withPhrase ? 48 : 74;
  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);
  if (legend) drawLegendCard(ctx, card, roundNumber);
  else drawCard(ctx, card, roundNumber);
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

  drawCardContent(ctx, card, roundNumber, {
    faceW: CARD_W,
    ink: tier.ink,
    ink2: tier.ink2,
    tierLabel: true,
  });
}
