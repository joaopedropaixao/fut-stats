import { GLYPH_HEIGHT, isPixelText, pixelDigitsPath } from './pixel-glyphs';

type PixelDigitsProps = {
  /** Número já formatado no padrão do app: vírgula decimal ("8,4"), placar ("4×3"), contagem ("+9"). */
  value: string | number;
  /** Escala inteira (nunca fração): altura = 9 x escala → 18, 27, 36... */
  scale?: number;
  className?: string;
  /** Texto para leitor de tela quando o número sozinho não diz o que é ("nota 8,4"). */
  label?: string;
  /** Esconde do leitor de tela quando o texto ao lado já diz o número (ex.: dentro do PixelText). */
  decorative?: boolean;
};

/** Todo número do app (nota, placar, contagem, data) é desenhado com estes dígitos, nunca com a fonte. */
export function PixelDigits({ value, scale = 3, className, label, decorative }: PixelDigitsProps) {
  const text = String(value);
  if (import.meta.env.DEV && !isPixelText(text)) {
    console.warn(`PixelDigits: "${text}" tem caractere sem dígito pixel`);
  }
  const { d, width } = pixelDigitsPath(text);
  const step = Math.max(1, Math.round(scale));

  return (
    <svg
      {...(decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label ?? text })}
      width={width * step}
      height={GLYPH_HEIGHT * step}
      viewBox={`0 0 ${width} ${GLYPH_HEIGHT}`}
      shapeRendering="crispEdges"
      className={['shrink-0', className].filter(Boolean).join(' ')}
    >
      <path d={d} fill="currentColor" />
    </svg>
  );
}
