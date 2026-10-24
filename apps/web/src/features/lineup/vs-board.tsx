import { TEAM_LABELS } from '@fut-stats/shared';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { SpriteTeam } from '../../components/ui/pixel-sprite-maps';
import { PlayerSprite } from '../../components/ui/pixel-sprite';
import { PixelText } from '../../components/ui/pixel-text';
import { cn } from '../../lib/cn';
import type { TeamKey } from './lineup-draft';
import { hasSeenVs, markVsSeen } from './vs-seen';

type Phase = 'entry' | 'clash' | 'final';

type VsBoardProps = {
  roundId: string;
  /** Titulares de cada time (os bonequinhos do quadro). */
  counts: Record<TeamKey, number>;
  /** O time de quem vê (`null` se não está escalado). */
  myTeam: TeamKey | null;
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

const VS_SHADOW = '[text-shadow:#000_4px_4px_0,#000_-2px_-2px_0,#000_2px_-2px_0,#000_-2px_2px_0]';

/**
 * O VS dos times (Momento/VS da folha): os jogadores entram um a um, o VS bate e o quadro final fica parado.
 * Na primeira vez da rodada toca (até 0,9 s, com "Pular"); depois vai direto ao quadro final. Com "reduzir
 * movimento" não anima: o quadro final aparece com um fade. A animação é decorativa (aria-hidden).
 */
export function VsBoard({ roundId, counts, myTeam }: VsBoardProps) {
  const [reduced] = useState(prefersReducedMotion);
  const [animated] = useState(() => !reduced && !hasSeenVs(roundId));
  const [phase, setPhase] = useState<Phase>(animated ? 'entry' : 'final');
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (animated) markVsSeen(roundId);
  }, [animated, roundId]);

  useEffect(() => {
    if (phase === 'final') return;
    const timer = setTimeout(
      () => setPhase(phase === 'entry' ? 'clash' : 'final'),
      phase === 'entry' ? ENTRY_MS : CLASH_MS,
    );
    return () => clearTimeout(timer);
  }, [phase]);

  // Depois do VS (ou do Pular) o foco vai para o conteúdo: o título do quadro
  useEffect(() => {
    if (animated && phase === 'final') heading.current?.focus({ preventScroll: true });
  }, [animated, phase]);

  const final = phase === 'final';
  const announcement = `Times publicados: ${TEAM_LABELS.WHITE} x ${TEAM_LABELS.BLACK}.${
    myTeam ? ` Você joga no ${TEAM_LABELS[myTeam]}.` : ''
  }`;

  return (
    <section className="relative">
      <h2 ref={heading} tabIndex={-1} className="sr-only outline-none">
        {announcement}
      </h2>
      <div
        aria-hidden
        className={cn(
          'relative h-70 overflow-hidden bg-[linear-gradient(104deg,#fff_50%,#000_50%)] shadow-card',
          reduced && 'animate-vs-fade',
        )}
      >
        <div className={cn('absolute inset-0', phase === 'clash' && 'animate-vs-shake')}>
          <TeamBlock team="WHITE" phase={phase} count={counts.WHITE} />
          <TeamBlock team="BLACK" phase={phase} count={counts.BLACK} />
          {phase === 'entry' && <SpeedLines />}
          {phase === 'clash' && <div className="animate-vs-flash absolute inset-0 bg-team-white" />}
          <span
            style={final && !animated ? { transform: 'rotate(-6deg)' } : undefined}
            className={cn(
              'pixel absolute top-[106px] left-1/2 -ml-15 flex h-17 w-30 items-center justify-center text-[56px] leading-[60px] tracking-[-4px] text-game',
              VS_SHADOW,
              phase === 'entry' && 'invisible',
              phase === 'clash' && 'animate-vs-pop',
              final && animated && 'animate-vs-settle',
            )}
          >
            VS
          </span>
        </div>
      </div>
      {!final && (
        <button
          type="button"
          onClick={() => setPhase('final')}
          className="absolute bottom-3 left-3 inline-flex min-h-11 items-center bg-team-black px-4 text-team-white shadow-[inset_0_0_0_2px_rgb(255_255_255/35%)] active:bg-surface-3"
        >
          <PixelText>Pular</PixelText>
        </button>
      )}
    </section>
  );
}

/** Um time no quadro: nome, 7 bonequinhos e a contagem. Branco em cima à esquerda, Preto embaixo à direita. */
function TeamBlock({ team, phase, count }: { team: TeamKey; phase: Phase; count: number }) {
  const white = team === 'WHITE';
  const sprite: SpriteTeam = white ? 'white' : 'black';
  const ink = white ? 'text-team-black' : 'text-team-white';
  const reveal = cn(phase !== 'final' && 'invisible');
  const players = Math.min(count, 7);
  return (
    <div
      className={cn(
        'absolute flex flex-col gap-1.5',
        white ? 'top-3.5 left-3.5' : 'right-3.5 bottom-3.5 items-end',
        ink,
      )}
    >
      {white && (
        <PixelText size={32} className={reveal}>
          {TEAM_LABELS[team]}
        </PixelText>
      )}
      {!white && <Counts count={count} className={reveal} />}
      <div className="flex gap-0.5">
        {Array.from({ length: players }, (_, i) => (
          <PlayerSprite
            key={i}
            team={sprite}
            scale={2}
            className={phase === 'entry' ? 'animate-vs-run' : undefined}
            style={
              {
                '--vs-from': white ? '-96px' : '96px',
                animationDelay: `${i * 70}ms`,
              } as CSSProperties
            }
          />
        ))}
      </div>
      {white && <Counts count={count} className={reveal} />}
      {!white && (
        <PixelText size={32} className={reveal}>
          {TEAM_LABELS[team]}
        </PixelText>
      )}
    </div>
  );
}

function Counts({ count, className }: { count: number; className?: string }) {
  return <PixelText className={className}>{`${count} jogadores`}</PixelText>;
}

/** Linhas de velocidade atrás de cada time, só na entrada. */
function SpeedLines() {
  const line = 'animate-vs-line absolute h-[3px]';
  const from = (v: string) => ({ '--vs-from': v }) as CSSProperties;
  return (
    <>
      <span style={from('-96px')} className={cn(line, 'top-6 left-1 w-3.5 bg-[#111]')} />
      <span style={from('-96px')} className={cn(line, 'top-8 left-1 w-2.5 bg-[#111]')} />
      <span style={from('96px')} className={cn(line, 'right-1 bottom-8 w-3.5 bg-team-white')} />
      <span style={from('96px')} className={cn(line, 'right-1 bottom-6 w-2.5 bg-team-white')} />
    </>
  );
}
