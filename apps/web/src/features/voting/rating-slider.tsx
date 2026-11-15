import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { PixelDigits } from '../../components/ui/pixel-digits';
import { cn } from '../../lib/cn';
import { formatRating } from '../../lib/rating-format';
import { ratingPhrase } from './rating-phrase';
import { ratingAtRatio, ratioOfRating, SCALE_MAX, SCALE_STEP } from './rating-scale';
import { FIRST_RATING } from './vote-flow';

type RatingSliderProps = {
  label: string;
  /** `null` = ainda sem nota: a régua não mostra o botão. */
  value: number | null;
  onChange: (value: number) => void;
};

const TICKS = Array.from({ length: SCALE_MAX / SCALE_STEP + 1 }, (_, i) => i * SCALE_STEP);

/**
 * Régua de 0 a 10 com marcas a cada 0,5 (folha: Card/Nota). O toque é o caminho principal: tocar num ponto pula
 * para aquela nota; arrastar é só atalho. Por baixo vai um `input type="range"` de verdade, para teclado e leitor
 * de tela (a primeira tecla numa nota vazia também parte de 6,0).
 */
export function RatingSlider({ label, value, onChange }: RatingSliderProps) {
  const track = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const fromPointer = (e: PointerEvent) => {
    const rect = track.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    onChange(ratingAtRatio((e.clientX - rect.left) / rect.width));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (value !== null) return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown'].includes(e.key)) {
      e.preventDefault();
      onChange(FIRST_RATING);
    }
  };

  const pct = value === null ? 0 : ratioOfRating(value) * 100;

  return (
    <div className="flex flex-col gap-2">
      <input
        type="range"
        aria-label={label}
        aria-valuetext={
          value === null ? 'Sem nota' : `${formatRating(value)}, ${ratingPhrase(value)}`
        }
        min={0}
        max={SCALE_MAX}
        step={SCALE_STEP}
        value={value ?? FIRST_RATING}
        onChange={(e) => onChange(Number(e.target.value))}
        onKeyDown={onKeyDown}
        className="peer sr-only"
      />
      <div
        // O foco do teclado aparece no desenho (o input de verdade fica escondido)
        className="relative h-12 touch-pan-y select-none peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-text"
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          fromPointer(e);
        }}
        onPointerMove={(e) => dragging.current && fromPointer(e)}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
      >
        <div ref={track} aria-hidden className="absolute inset-x-5 top-0 bottom-0">
          <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 bg-track" />
          <div
            className="absolute top-1/2 left-0 h-2 -translate-y-1/2 bg-accent"
            style={{ width: `${pct}%` }}
          />
          {value !== null && (
            <span
              className="absolute top-1/2 size-9 -translate-x-1/2 -translate-y-1/2 rounded-full bg-text shadow-[0_0_0_4px_var(--color-accent),3px_3px_0_4px_var(--color-shadow)]"
              style={{ left: `${pct}%` }}
            />
          )}
        </div>
      </div>
      <div aria-hidden className="relative mx-5 h-3">
        {TICKS.map((tick) => (
          <span
            key={tick}
            className={cn(
              'absolute top-0 w-0.5 -translate-x-1/2 bg-border-strong',
              tick % 1 === 0 ? 'h-3' : 'h-1.5',
            )}
            style={{ left: `${ratioOfRating(tick) * 100}%` }}
          />
        ))}
      </div>
      <div aria-hidden className="relative mx-5 h-[18px]">
        {[0, 5, 10].map((mark) => (
          <span
            key={mark}
            className="absolute top-0 -translate-x-1/2 text-text-muted"
            style={{ left: `${ratioOfRating(mark) * 100}%` }}
          >
            <PixelDigits value={mark} scale={2} decorative />
          </span>
        ))}
      </div>
    </div>
  );
}
