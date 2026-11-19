import type { CSSProperties } from 'react';
import { PixelText } from '../../components/ui/pixel-text';
import { spritePaths, type SpriteMap } from '../../components/ui/pixel-sprite-maps';
import { cn } from '../../lib/cn';

/**
 * Pixel art da moldura de madeira do Perna de Pau (Paper: "ajustes-feedback (v1.1)", variação A): o pé torto do
 * canto, a rachadura da madeira e o prego do selo. Mapas de caracteres como o resto dos sprites (uma letra por
 * cor, `.` é vazio), cores só por tokens. Decoração: sempre `aria-hidden`.
 */

/** O pé torto: a perna de meia com o curativo, saindo do chão (12 x 11). K contorno, S meia, R curativo, B chão. */
const FOOT: SpriteMap = [
  '.....KKK....',
  '.....KSK....',
  '.....KSK....',
  '.....KRK....',
  '.....KSK....',
  '....KSSK....',
  'KK..KBBK....',
  'KBK.KBBBK...',
  'KBBKBBBBBK..',
  'KBBBBBBBBBK.',
  '.KKKKKKKKKK.',
];

const FOOT_PALETTE = {
  K: 'var(--color-outline)',
  S: 'var(--color-text)',
  R: 'var(--color-flop-blood)',
  B: 'var(--color-flop-edge)',
};

/** A rachadura: um zigue-zague de degraus de 1 px, de cima para baixo (12 x 11). */
const CRACK: SpriteMap = [
  'K...........',
  '.K..........',
  '.KK.........',
  '..K.........',
  '..KK..K.....',
  '...KKK......',
  '....K.......',
  '....KK......',
  '.....K......',
  '.....KK.....',
  '......K.....',
];

const CRACK_PALETTE = { K: 'var(--color-flop-crack)' };

/** O prego que prende o selo da faixa na madeira (4 x 4). K contorno, W brilho, G corpo. */
const NAIL: SpriteMap = ['.KK.', 'KWGK', 'KGGK', '.KK.'];

const NAIL_PALETTE = {
  K: 'var(--color-outline)',
  W: 'var(--color-silver-light)',
  G: 'var(--color-flop-nail)',
};

type SpriteProps = { className?: string };

function Sprite({
  map,
  palette,
  className,
  style,
}: SpriteProps & { map: SpriteMap; palette: Record<string, string>; style?: CSSProperties }) {
  const paths = spritePaths(map, palette);
  return (
    <svg
      aria-hidden
      focusable="false"
      viewBox={`0 0 ${map[0]!.length} ${map.length}`}
      shapeRendering="crispEdges"
      className={className}
      style={style}
    >
      {Object.entries(paths).map(([color, d]) => (
        <path key={color} d={d} fill={color} />
      ))}
    </svg>
  );
}

/** O pé torto do canto de baixo da carta. O tamanho vem do `className` (grade 12 x 11). */
export function FootSprite({ className }: SpriteProps) {
  return <Sprite map={FOOT} palette={FOOT_PALETTE} className={className} />;
}

/** Uma rachadura da madeira. O tamanho vem do `className` (grade 12 x 11). */
export function CrackSprite({ className }: SpriteProps) {
  return <Sprite map={CRACK} palette={CRACK_PALETTE} className={className} />;
}

/**
 * A rachadura que nasce da beirada de cima: só a ponta que cabe na madeira (`height` px), cortada rente ao miolo, para
 * nenhuma decoração passar por cima do texto da tira do time (BRANCO é mais comprido que PRETO). A rachadura inteira
 * (grade 12 x 11) é desenhada em `scale` px por pixel e o resto fica escondido.
 */
export function EdgeCrack({
  height,
  scale,
  className,
}: {
  height: number;
  scale: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      style={{ height, width: 12 * scale }}
      className={cn('pointer-events-none absolute top-0 overflow-hidden', className)}
    >
      <Sprite
        map={CRACK}
        palette={CRACK_PALETTE}
        className="block"
        style={{ width: 12 * scale, height: 11 * scale }}
      />
    </span>
  );
}

/** O prego do selo da faixa. O tamanho vem do `className` (grade 4 x 4). */
export function NailSprite({ className }: SpriteProps) {
  return <Sprite map={NAIL} palette={NAIL_PALETTE} className={className} />;
}

/**
 * O selo da faixa do Perna de Pau: "BRONZE", "PRATA" ou "OURO" na cor da faixa (`--tier-bg`, que o `.card-frame`
 * define pela nota), preso na madeira por um prego e levemente girado. O texto escrito é o sinal; a cor sozinha
 * não basta. O posicionamento vem do `className` de quem usa.
 */
export function TierSeal({ label, className }: { label: string; className?: string }) {
  return (
    <span
      aria-hidden
      style={{ backgroundImage: 'var(--tier-bg)' }}
      className={cn(
        'flex items-center gap-1.5 py-1 pr-2 pl-1.5 text-(--tier-ink)',
        'shadow-[inset_0_0_0_2px_var(--color-outline),3px_3px_0_0_var(--color-outline)]',
        className,
      )}
    >
      <NailSprite className="size-3 shrink-0" />
      <PixelText>{label}</PixelText>
    </span>
  );
}
