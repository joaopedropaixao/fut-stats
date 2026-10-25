import {
  MATCH_RESULT_LABELS,
  TEAM_LABELS,
  type MatchResult,
  type MatchScore,
} from '@fut-stats/shared';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { PixelDigits } from '../../components/ui/pixel-digits';
import { PlayerSprite } from '../../components/ui/pixel-sprite';
import { PixelText } from '../../components/ui/pixel-text';
import { cn } from '../../lib/cn';
import { resultAnnouncement } from './match-text';
import { markResultSeen } from './result-seen';

type Team = 'WHITE' | 'BLACK';
type Phase = 'entry' | 'clash' | 'final';

type ResultCardProps = {
  roundId: string;
  result: MatchResult;
  score: MatchScore;
  /** O time de quem vê. */
  myTeam: Team;
};

/** Entrada 0–0,6 s, choque 0,6–0,9 s, depois o quadro final (que fica parado). */
const ENTRY_MS = 600;
const CLASH_MS = 300;

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

const BACKDROP: Record<MatchResult, string> = {
  WIN: 'bg-field',
  LOSS: 'bg-track',
  DRAW: 'bg-[linear-gradient(104deg,#fff_50%,#000_50%)]',
};

const TITLE_SHADOW =
  '[text-shadow:#000_4px_4px_0,#000_-2px_-2px_0,#000_2px_-2px_0,#000_-2px_2px_0]';

/** A estrela pixel (7x7) das festas: enfeite do YOU WIN. */
const STAR = ['...#...', '..###..', '#######', '.#####.', '..###..', '.##.##.', '.#...#.'];

const STAR_PATH = STAR.flatMap((row, y) =>
  [...row].map((c, x) => (c === '#' ? `M${x} ${y}h1v1h-1z` : '')),
).join('');

/** Posições (em %) e tamanhos das estrelas do YOU WIN, cada uma com o seu ritmo. */
const STARS = [
  { left: '8%', top: 92, size: 28, color: 'text-game', delay: 0 },
  { left: '84%', top: 80, size: 21, color: 'text-team-white', delay: 200 },
  { left: '70%', top: 142, size: 14, color: 'text-game', delay: 400 },
  { left: '20%', top: 148, size: 14, color: 'text-team-white', delay: 100 },
] as const;

function PixelStar({ size, className }: { size: number; className: string }) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 7 7"
      shapeRendering="crispEdges"
      className={className}
    >
      <path d={STAR_PATH} fill="currentColor" />
    </svg>
  );
}

/** Confete pixel: quadradinhos que caem em degraus. Posição, cor e ritmo fixos, para o quadro ser sempre o mesmo. */
const CONFETTI = [
  { x: 6, c: 'bg-game', s: 10, dx: 10, d: 0, t: 1300 },
  { x: 13, c: 'bg-team-white', s: 8, dx: -8, d: 120, t: 1500 },
  { x: 19, c: 'bg-success', s: 10, dx: 14, d: 40, t: 1200 },
  { x: 26, c: 'bg-gold', s: 8, dx: -12, d: 260, t: 1400 },
  { x: 32, c: 'bg-game', s: 8, dx: 8, d: 180, t: 1100 },
  { x: 39, c: 'bg-team-white', s: 10, dx: -6, d: 60, t: 1500 },
  { x: 45, c: 'bg-success', s: 8, dx: 12, d: 300, t: 1300 },
  { x: 51, c: 'bg-game', s: 10, dx: -10, d: 20, t: 1400 },
  { x: 57, c: 'bg-gold', s: 8, dx: 6, d: 220, t: 1200 },
  { x: 63, c: 'bg-team-white', s: 8, dx: -14, d: 100, t: 1500 },
  { x: 69, c: 'bg-success', s: 10, dx: 10, d: 340, t: 1100 },
  { x: 75, c: 'bg-game', s: 8, dx: -8, d: 140, t: 1300 },
  { x: 81, c: 'bg-gold', s: 10, dx: 12, d: 0, t: 1400 },
  { x: 87, c: 'bg-team-white', s: 8, dx: -6, d: 280, t: 1200 },
  { x: 93, c: 'bg-game', s: 10, dx: 8, d: 80, t: 1500 },
  { x: 10, c: 'bg-gold', s: 8, dx: 6, d: 420, t: 1300 },
  { x: 36, c: 'bg-success', s: 10, dx: -12, d: 460, t: 1100 },
  { x: 60, c: 'bg-game', s: 8, dx: 10, d: 400, t: 1400 },
  { x: 78, c: 'bg-team-white', s: 10, dx: -10, d: 480, t: 1200 },
  { x: 48, c: 'bg-gold', s: 8, dx: 8, d: 520, t: 1300 },
] as const;

function Confetti() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {CONFETTI.map((piece, i) => (
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

/** A faixa do time na vitória: o time de quem vê, com as cores dele, de ponta a ponta do card. */
function TeamBand({ team, shown }: { team: Team; shown: boolean }) {
  const white = team === 'WHITE';
  return (
    <div
      className={cn(
        'absolute inset-x-0 top-0 flex h-10 items-center justify-center gap-3',
        white
          ? 'bg-team-white text-team-black shadow-[inset_0_-3px_0_0_#000]'
          : 'bg-team-black text-team-white shadow-[inset_0_-3px_0_0_rgb(255_255_255/35%)]',
        shown ? 'animate-moment-in' : 'invisible',
      )}
    >
      <PixelStar size={14} className="text-game" />
      <PixelText>{`Vitória do ${TEAM_LABELS[team]}`}</PixelText>
      <PixelStar size={14} className="text-game" />
    </div>
  );
}

/**
 * O grande momento do resultado (YOU WIN / YOU LOSE / EMPATE), no padrão do VS dos times: o time entra correndo,
 * o título bate e o quadro final fica parado com o placar. Card de contorno grosso e sombra dura, que entra em
 * degraus. Na vitória tem mais festa: faixa do time, confete e estrelas pixel, e os dígitos batem. Toca uma vez
 * por rodada (o chamador decide); "Pular" leva ao quadro final. Com "reduzir movimento" só aparece o quadro
 * final, com um fade (sem confete). A animação é decorativa (aria-hidden): o resultado é anunciado em texto.
 */
export function ResultCard({ roundId, result, score, myTeam }: ResultCardProps) {
  const [reduced] = useState(prefersReducedMotion);
  const [phase, setPhase] = useState<Phase>(reduced ? 'final' : 'entry');
  const [animated] = useState(!reduced);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => markResultSeen(roundId), [roundId]);

  useEffect(() => {
    if (phase === 'final') return;
    const timer = setTimeout(
      () => setPhase(phase === 'entry' ? 'clash' : 'final'),
      phase === 'entry' ? ENTRY_MS : CLASH_MS,
    );
    return () => clearTimeout(timer);
  }, [phase]);

  // Depois da animação (ou do Pular), o foco vai para o conteúdo: o resultado dito em texto
  useEffect(() => {
    if (animated && phase === 'final') heading.current?.focus({ preventScroll: true });
  }, [animated, phase]);

  const final = phase === 'final';
  const win = result === 'WIN';
  const sprite = myTeam === 'WHITE' ? 'white' : 'black';
  const party = win && animated && phase !== 'entry';

  return (
    <section className="relative" aria-label="Resultado do jogo">
      <h2 ref={heading} tabIndex={-1} className="sr-only outline-none">
        {resultAnnouncement(result, score, myTeam)}
      </h2>
      <div
        aria-hidden
        className={cn(
          'moment-frame animate-moment-in relative overflow-hidden',
          win ? 'h-84' : 'h-70',
          BACKDROP[result],
        )}
      >
        <div className={cn('absolute inset-0', phase === 'clash' && 'animate-vs-shake')}>
          {win && <TeamBand team={myTeam} shown={phase !== 'entry'} />}
          <div className={cn('absolute left-4 flex gap-0.5', win ? 'top-13' : 'top-4')}>
            {Array.from({ length: 7 }, (_, i) => (
              <PlayerSprite
                key={i}
                team={sprite}
                scale={2}
                className={phase === 'entry' ? 'animate-vs-run' : undefined}
                style={{ '--vs-from': '-96px', animationDelay: `${i * 70}ms` } as CSSProperties}
              />
            ))}
          </div>
          {win &&
            final &&
            STARS.map((star, i) => (
              <span
                key={i}
                style={
                  {
                    left: star.left,
                    top: star.top,
                    '--moment-delay': `${star.delay}ms`,
                  } as CSSProperties
                }
                className={cn('absolute', animated && 'animate-star-twinkle')}
              >
                <PixelStar size={star.size} className={star.color} />
              </span>
            ))}
          <span
            className={cn(
              'pixel absolute inset-x-0 flex justify-center text-[40px] leading-[48px] tracking-[-2px] text-game',
              win ? 'top-[92px]' : 'top-[68px]',
              TITLE_SHADOW,
              phase === 'entry' && 'invisible',
              phase === 'clash' && 'animate-vs-pop',
              final && animated && 'animate-vs-settle',
              final && !animated && '-rotate-6',
            )}
          >
            {MATCH_RESULT_LABELS[result]}
          </span>
          <div
            className={cn(
              'absolute inset-x-5 bottom-4 flex items-end justify-between',
              !final && 'invisible',
            )}
          >
            <ScoreSide
              team="WHITE"
              value={score.WHITE}
              mine={myTeam === 'WHITE'}
              bump={win && animated && final}
            />
            <ScoreSide
              team="BLACK"
              value={score.BLACK}
              mine={myTeam === 'BLACK'}
              bump={win && animated && final}
            />
          </div>
          {party && <Confetti />}
        </div>
      </div>
      {!final && (
        <button
          type="button"
          onClick={() => setPhase('final')}
          className="absolute bottom-4 left-4 inline-flex min-h-11 items-center bg-team-black px-4 text-team-white shadow-[inset_0_0_0_2px_rgb(255_255_255/35%)] focus-visible:shadow-[inset_0_0_0_2px_rgb(255_255_255/35%),0_0_0_2px_var(--color-team-black)] active:bg-surface-3"
        >
          <PixelText>Pular</PixelText>
        </button>
      )}
    </section>
  );
}

/** Um lado do quadro final: dígitos e o nome do time, que sempre aparece escrito. "Você" marca o time de quem vê. */
function ScoreSide({
  team,
  value,
  mine,
  bump,
}: {
  team: Team;
  value: number;
  mine: boolean;
  /** Na vitória, o dígito bate ao aparecer. */
  bump: boolean;
}) {
  const white = team === 'WHITE';
  return (
    <div
      className={cn(
        'flex w-[46%] flex-col gap-1.5 px-3 pt-3 pb-2',
        white
          ? 'items-start bg-team-white text-team-black shadow-[inset_0_0_0_3px_#000]'
          : 'items-end bg-team-black text-team-white shadow-[inset_0_0_0_2px_rgb(255_255_255/35%)]',
      )}
    >
      <span
        style={{ '--moment-delay': white ? '0ms' : '120ms', '--bump-scale': 1.25 } as CSSProperties}
        className={cn('inline-flex', bump && 'animate-digit-bump')}
      >
        <PixelDigits value={value} scale={8} decorative />
      </span>
      <PixelText>{TEAM_LABELS[team]}</PixelText>
      {mine && <PixelText>Você</PixelText>}
    </div>
  );
}
