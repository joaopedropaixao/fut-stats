// Gera os ícones do app (PWA, favicon, iPhone) a partir da bola pixel da capa (a mesma de
// apps/web/src/pages/entrar-e-grupo/chalk.tsx, sem o rastro), sobre o fundo Gramado.
// Sem dependências: PNG escrito à mão com zlib.
// Rodar: node apps/web/scripts/generate-icons.mjs
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

// Contorno preto (K), gomos (P), branco (W) e a sombra creme embaixo à direita (S)
const BALL = [
  '.....KKKK.....',
  '...KKPPPPKK...',
  '..KWWPPPPWWK..',
  '.KWWWWPPWWWWK.',
  '.KPWWWWWWWWPK.',
  'KPPWWWPPWWWPPK',
  'KPPWWPPPPWWPPK',
  'KPWWWPPPPWWWSK',
  'KWWWWWPPWWWWSK',
  '.KWWWWWWWWWSK.',
  '.KWPPWWWWPPSK.',
  '..KPPPWWPPSK..',
  '...KKPSSPKK...',
  '.....KKKK.....',
];
const COLORS = {
  K: [0x00, 0x00, 0x00],
  P: [0x11, 0x11, 0x11],
  W: [0xff, 0xff, 0xff],
  S: [0xcf, 0xca, 0xb5], // --color-text-muted
};
const BG = [0x0d, 0x27, 0x17]; // --color-bg (Gramado)
const OUT = new URL('../public/', import.meta.url);

/** Pixel (x, y) do ícone: a bola ocupa ~55% do lado, em escala inteira, centralizada. */
function painter(size) {
  const scale = Math.floor((size * 0.55) / BALL.length);
  const offset = Math.floor((size - BALL.length * scale) / 2);
  return (x, y) => {
    const gx = Math.floor((x - offset) / scale);
    const gy = Math.floor((y - offset) / scale);
    return COLORS[BALL[gy]?.[gx]] ?? BG;
  };
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size) {
  const paint = painter(size);
  const raw = Buffer.alloc(size * (1 + size * 3));
  for (let y = 0; y < size; y++) {
    const row = y * (1 + size * 3);
    raw[row] = 0; // filtro "None"
    for (let x = 0; x < size; x++) raw.set(paint(x, y), row + 1 + x * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // 8 bits por canal
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** No favicon a bola ocupa quase tudo (fica pequeno na aba): 1 pixel de folga em volta. */
const SVG_PAD = 1;
const SVG_SIDE = BALL.length + SVG_PAD * 2;

function svg() {
  const hex = (rgb) => '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');
  const rects = BALL.flatMap((line, y) =>
    [...line].flatMap((c, x) =>
      COLORS[c]
        ? [
            `<rect x="${x + SVG_PAD}" y="${y + SVG_PAD}" width="1" height="1" fill="${hex(COLORS[c])}"/>`,
          ]
        : [],
    ),
  );
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SVG_SIDE} ${SVG_SIDE}" shape-rendering="crispEdges">` +
    `<rect width="${SVG_SIDE}" height="${SVG_SIDE}" fill="${hex(BG)}"/>${rects.join('')}</svg>\n`
  );
}

const files = {
  'pwa-192x192.png': png(192),
  'pwa-512x512.png': png(512),
  'maskable-512x512.png': png(512),
  'apple-touch-icon-180x180.png': png(180),
  'favicon.svg': svg(),
};
for (const [name, data] of Object.entries(files)) writeFileSync(new URL(name, OUT), data);
console.log(`ícones gerados em ${OUT.pathname}`);
