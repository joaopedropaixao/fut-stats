import type { CSSProperties } from 'react';
import { cn } from '../../lib/cn';

/**
 * Confete pixel curto de quem subiu no ranking: quadradinhos que caem em degraus (meio segundo) dentro do card. Posição,
 * cor e ritmo fixos, para o quadro ser sempre o mesmo. Sem amarelo (é só da tecla de ação): ouro, verde e branco.
 */
const PIECES = [
  { x: 8, c: 'bg-gold', s: 8, dx: 8, d: 0, t: 520 },
  { x: 16, c: 'bg-team-white', s: 8, dx: -6, d: 60, t: 560 },
  { x: 24, c: 'bg-success', s: 10, dx: 10, d: 20, t: 500 },
  { x: 33, c: 'bg-gold', s: 8, dx: -10, d: 90, t: 540 },
  { x: 42, c: 'bg-team-white', s: 10, dx: 6, d: 30, t: 580 },
  { x: 51, c: 'bg-success', s: 8, dx: -8, d: 110, t: 520 },
  { x: 60, c: 'bg-gold', s: 10, dx: 12, d: 10, t: 560 },
  { x: 69, c: 'bg-team-white', s: 8, dx: -12, d: 80, t: 500 },
  { x: 78, c: 'bg-success', s: 10, dx: 8, d: 40, t: 540 },
  { x: 86, c: 'bg-gold', s: 8, dx: -6, d: 100, t: 580 },
  { x: 93, c: 'bg-team-white', s: 10, dx: 10, d: 50, t: 520 },
  { x: 37, c: 'bg-success', s: 8, dx: 6, d: 120, t: 500 },
] as const;

export function RankConfetti() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {PIECES.map((piece, i) => (
        <span
          key={i}
          style={
            {
              left: `${piece.x}%`,
              width: piece.s,
              height: piece.s,
              '--dx': `${piece.dx}px`,
              '--dur': `${piece.t}ms`,
              '--moment-delay': `${piece.d}ms`,
            } as CSSProperties
          }
          className={cn('animate-confetti-fall absolute top-0', piece.c)}
        />
      ))}
    </div>
  );
}
