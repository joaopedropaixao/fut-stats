import type { SpriteMap } from '../../components/ui/pixel-sprite-maps';
import type { PackCard } from './deck';
import { LEGEND_PALETTE, SPARK, SPIKE, TROPHY, WING } from './legend-sprite-maps';
import { drawCardContent, resolveColor, text } from './share-draw';
import { TIER_LABELS } from './tier';

/**
 * A carta do Craque no Compartilhar: a moldura "Lenda" desenhada no canvas (fundo dourado metálico, cantos em
 * degraus, friso duplo, troféu com asas, ponteiras, faíscas e o selo escuro da faixa). Mesmas medidas da carta na tela
 * (240 x 370 unidades de CSS), a mesma moldura para qualquer nota: só o selo muda de faixa.
 */
export const LEGEND_W = 240;
export const LEGEND_H = 370;

const TOP = 54;
const PAD = 20;
const FACE_W = LEGEND_W - PAD * 2;
const FACE_H = 276;
const FRAME_H = FACE_H + PAD * 2;

const INK = '#140b02';
const INK_2 = '#3a2204';

/** A grade em pixels do canvas. As cores são as mesmas da carta na tela (o canvas não lê `color-mix`). */
const CANVAS_PALETTE: Record<string, string> = {
  K: LEGEND_PALETTE.K,
  W: '#f9e8a6',
  Y: 'var(--color-gold-light)',
  G: 'var(--color-gold)',
  D: 'var(--color-gold-shadow)',
};

function drawSprite(
  ctx: CanvasRenderingContext2D,
  map: SpriteMap,
  x: number,
  y: number,
  scale: number,
  mirror = false,
) {
  const w = map[0]!.length;
  map.forEach((line, row) =>
    [...line].forEach((ch, col) => {
      const color = CANVAS_PALETTE[ch];
      if (!color) return;
      ctx.fillStyle = resolveColor(color);
      const px = mirror ? w - 1 - col : col;
      ctx.fillRect(x + px * scale, y + row * scale, scale, scale);
    }),
  );
}

/** O retângulo com os cantos em degraus de 5 unidades (4 degraus), o mesmo recorte da moldura na tela. */
function steppedPath(x: number, y: number, w: number, h: number): Path2D {
  const path = new Path2D();
  const s = 5;
  const n = 4;
  path.moveTo(x, y + s * n);
  for (let i = 0; i < n; i += 1) {
    path.lineTo(x + s * i, y + s * (n - i));
    path.lineTo(x + s * i, y + s * (n - i - 1));
    path.lineTo(x + s * (i + 1), y + s * (n - i - 1));
  }
  path.lineTo(x + w - s * n, y);
  for (let i = 0; i < n; i += 1) {
    path.lineTo(x + w - s * (n - i), y + s * i);
    path.lineTo(x + w - s * (n - i - 1), y + s * i);
    path.lineTo(x + w - s * (n - i - 1), y + s * (i + 1));
  }
  path.lineTo(x + w, y + h - s * n);
  for (let i = 0; i < n; i += 1) {
    path.lineTo(x + w - s * i, y + h - s * (n - i));
    path.lineTo(x + w - s * i, y + h - s * (n - i - 1));
    path.lineTo(x + w - s * (i + 1), y + h - s * (n - i - 1));
  }
  path.lineTo(x + s * n, y + h);
  for (let i = 0; i < n; i += 1) {
    path.lineTo(x + s * (n - i), y + h - s * i);
    path.lineTo(x + s * (n - i - 1), y + h - s * i);
    path.lineTo(x + s * (n - i - 1), y + h - s * (i + 1));
  }
  path.closePath();
  return path;
}

/** A moldura (igual para qualquer nota): sombra dura, contorno preto, ouro com friso duplo. */
function drawFrame(ctx: CanvasRenderingContext2D) {
  const shape = (dx: number, dy: number) => steppedPath(dx, TOP + dy, LEGEND_W, FRAME_H);
  ctx.fillStyle = '#000';
  ctx.fill(shape(7, 7));
  for (const [dx, dy] of [
    [-3, 0],
    [3, 0],
    [0, -3],
    [0, 3],
  ] as const)
    ctx.fill(shape(dx, dy));
  const gold = ctx.createLinearGradient(0, TOP, LEGEND_W, TOP + FRAME_H);
  gold.addColorStop(0, '#5a3606');
  gold.addColorStop(0.2, '#d49a22');
  gold.addColorStop(0.44, '#ffe680');
  gold.addColorStop(0.7, '#b97a14');
  gold.addColorStop(1, '#4a2c04');
  ctx.fillStyle = gold;
  ctx.fill(shape(0, 0));
  // o friso duplo: uma linha escura e uma clara dentro da moldura
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(58,36,3,0.75)';
  ctx.strokeRect(9, TOP + 9, LEGEND_W - 18, FRAME_H - 18);
  ctx.strokeStyle = 'rgba(255,244,180,0.8)';
  ctx.strokeRect(14, TOP + 14, LEGEND_W - 28, FRAME_H - 28);
}

/** O miolo dourado metálico: bisel, clarão de canto e a faixa de reflexo parada. */
function drawFace(ctx: CanvasRenderingContext2D, special: boolean) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, FACE_W, FACE_H);
  const gold = ctx.createLinearGradient(0, 0, FACE_W, FACE_H);
  gold.addColorStop(0, '#fff0a8');
  gold.addColorStop(0.2, '#f8cf4a');
  gold.addColorStop(0.38, '#e8a93a');
  gold.addColorStop(0.56, '#ffe27a');
  gold.addColorStop(0.76, '#f2b83c');
  gold.addColorStop(1, '#c98a1a');
  ctx.fillStyle = gold;
  ctx.fillRect(3, 3, FACE_W - 6, FACE_H - 6);
  const glow = ctx.createRadialGradient(
    FACE_W * 0.28,
    FACE_H * 0.18,
    4,
    FACE_W * 0.28,
    FACE_H * 0.18,
    120,
  );
  glow.addColorStop(0, 'rgba(255,246,190,0.75)');
  glow.addColorStop(1, 'rgba(255,246,190,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(3, 3, FACE_W - 6, FACE_H - 6);
  // a faixa de reflexo, na diagonal
  ctx.save();
  ctx.beginPath();
  ctx.rect(3, 3, FACE_W - 6, FACE_H - 6);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.42)';
  ctx.beginPath();
  ctx.moveTo(FACE_W * 0.52, 0);
  ctx.lineTo(FACE_W * 0.62, 0);
  ctx.lineTo(FACE_W * 0.3, FACE_H);
  ctx.lineTo(FACE_W * 0.2, FACE_H);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // o bisel de dentro: sombra em cima e à esquerda, luz embaixo e à direita
  ctx.fillStyle = 'rgba(74,44,4,0.55)';
  ctx.fillRect(3, 3, FACE_W - 6, 5);
  ctx.fillRect(3, 3, 5, FACE_H - 6);
  ctx.fillStyle = 'rgba(255,244,180,0.7)';
  ctx.fillRect(3, FACE_H - 8, FACE_W - 6, 5);
  ctx.fillRect(FACE_W - 8, 3, 5, FACE_H - 6);
  if (special) {
    // O Craque sou eu: o contorno creme da carta especial, dentro do preto
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#f3ead3';
    ctx.strokeRect(4.5, 4.5, FACE_W - 9, FACE_H - 9);
    ctx.strokeStyle = '#000';
    ctx.strokeRect(7.5, 7.5, FACE_W - 15, FACE_H - 15);
  }
}

/** Troféu com asas, ponteiras e faíscas em volta. */
function drawOrnaments(ctx: CanvasRenderingContext2D) {
  const mid = LEGEND_W / 2;
  drawSprite(ctx, WING, mid - 24 - 56, 4, 4);
  drawSprite(ctx, WING, mid + 24, 4, 4, true);
  drawSprite(ctx, TROPHY, mid - 24, 0, 3);
  for (const [x, flip] of [
    [-10, false],
    [LEGEND_W - 18, true],
  ] as const) {
    ctx.save();
    ctx.translate(x + 14, TOP - 20 + 14);
    ctx.rotate(((flip ? 14 : -14) * Math.PI) / 180);
    drawSprite(ctx, SPIKE, -14, -14, 4);
    ctx.restore();
  }
  // As faíscas: cruzes de luz em volta da carta, fora do texto
  for (const [x, y] of [
    [8, 0],
    [-26, TOP + 64],
    [LEGEND_W + 8, TOP + FRAME_H * 0.46],
    [-24, TOP + FRAME_H - 40],
    [LEGEND_W - 40, TOP + FRAME_H + 4],
    [LEGEND_W - 15, TOP + 16],
  ])
    drawSprite(ctx, SPARK, x!, y!, 3);
}

/**
 * O selo escuro da faixa, preso no canto de cima (mais abaixo quando o Craque sou eu, para não encostar no VOCÊ):
 * fundo preto, friso e letra na cor da faixa, sombra dura, levemente girado.
 */
function drawSeal(ctx: CanvasRenderingContext2D, card: PackCard) {
  const color = resolveColor(
    card.tier === 'gold'
      ? 'var(--color-gold-light)'
      : card.tier === 'silver'
        ? 'var(--color-silver-light)'
        : 'var(--color-bronze-light)',
  );
  const label = TIER_LABELS[card.tier].toUpperCase();
  ctx.font = '700 16px Silkscreen, monospace';
  const w = Math.ceil(ctx.measureText(label).width) + 6 + 12 + 6 + 8;
  const h = 28;
  ctx.save();
  ctx.translate(LEGEND_W - 12 - w + 12, card.you ? 112 : 96);
  ctx.rotate((6 * Math.PI) / 180);
  ctx.fillStyle = '#000';
  ctx.fillRect(4, 4, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#000';
  ctx.fillRect(3, 3, w - 6, h - 6);
  // o prego
  ctx.fillStyle = '#93a0ad';
  ctx.fillRect(9, 10, 8, 8);
  ctx.fillStyle = '#111';
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1;
  ctx.strokeRect(9.5, 10.5, 7, 7);
  text(ctx, label, 24, 6, { color });
  ctx.restore();
}

/** Desenha a carta do Craque com a moldura "Lenda" (a origem é o canto de cima à esquerda da área de 240 x 370). */
export function drawLegendCard(ctx: CanvasRenderingContext2D, card: PackCard, roundNumber: number) {
  drawFrame(ctx);
  ctx.save();
  ctx.translate(PAD, TOP + PAD);
  drawFace(ctx, Boolean(card.you));
  ctx.beginPath();
  ctx.rect(3, 3, FACE_W - 6, FACE_H - 6);
  ctx.clip();
  drawCardContent(ctx, card, roundNumber, {
    faceW: FACE_W,
    ink: INK,
    ink2: INK_2,
    tierLabel: false,
    emboss: true,
  });
  ctx.restore();
  drawOrnaments(ctx);
  // O selo é o último desenho (e o único que gira): é a única diferença entre as faixas
  drawSeal(ctx, card);
}
