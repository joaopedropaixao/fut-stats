import { MATCH_RESULT_LABELS, TEAM_LABELS, type MatchView } from '@fut-stats/shared';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { PixelDigits } from '../../components/ui/pixel-digits';
import { PlayerSprite } from '../../components/ui/pixel-sprite';
import { PixelText } from '../../components/ui/pixel-text';
import { cn } from '../../lib/cn';
import { resultAnnouncement } from './match-text';
import { markResultSeen } from './result-seen';

type Team = 'WHITE' | 'BLACK';
type MatchResult = NonNullable<MatchView['me']['result']>;
type MatchScore = NonNullable<MatchView['score']>;
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

/**
 * O grande momento do resultado (YOU WIN / YOU LOSE / EMPATE), no padrão do VS dos times: o time entra correndo,
 * o título bate e o quadro final fica parado com o placar. Toca uma vez por rodada (o chamador decide);
 * "Pular" leva ao quadro final. Com "reduzir movimento" só aparece o quadro final, com um fade. A animação é
 * decorativa (aria-hidden): o resultado é anunciado em texto.
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
  const sprite = myTeam === 'WHITE' ? 'white' : 'black';

  return (
    <section className="relative" aria-label="Resultado do jogo">
      <h2 ref={heading} tabIndex={-1} className="sr-only outline-none">
        {resultAnnouncement(result, score, myTeam)}
      </h2>
      <div
        aria-hidden
        className={cn(
          'relative h-70 overflow-hidden shadow-card',
          BACKDROP[result],
          reduced && 'animate-vs-fade',
        )}
      >
        <div className={cn('absolute inset-0', phase === 'clash' && 'animate-vs-shake')}>
          <div className="absolute top-4 left-4 flex gap-0.5">
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
          <span
            className={cn(
              'pixel absolute inset-x-0 top-[68px] flex justify-center text-[40px] leading-[48px] tracking-[-2px] text-game',
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
            <ScoreSide team="WHITE" value={score.WHITE} mine={myTeam === 'WHITE'} />
            <ScoreSide team="BLACK" value={score.BLACK} mine={myTeam === 'BLACK'} />
          </div>
        </div>
      </div>
      {!final && (
        <button
          type="button"
          onClick={() => setPhase('final')}
          className="absolute bottom-3 left-3 inline-flex min-h-11 items-center bg-team-black px-4 text-team-white shadow-[inset_0_0_0_2px_rgb(255_255_255/35%)] focus-visible:shadow-[inset_0_0_0_2px_rgb(255_255_255/35%),0_0_0_2px_var(--color-team-black)] active:bg-surface-3"
        >
          <PixelText>Pular</PixelText>
        </button>
      )}
    </section>
  );
}

/** Um lado do quadro final: dígitos e o nome do time, que sempre aparece escrito. "Você" marca o time de quem vê. */
function ScoreSide({ team, value, mine }: { team: Team; value: number; mine: boolean }) {
  const white = team === 'WHITE';
  return (
    <div
      className={cn(
        'flex w-[46%] flex-col gap-1.5 px-3 pt-3 pb-2',
        white
          ? 'items-start bg-team-white text-team-black'
          : 'items-end bg-team-black text-team-white shadow-[inset_0_0_0_2px_rgb(255_255_255/35%)]',
      )}
    >
      <PixelDigits value={value} scale={8} decorative />
      <PixelText>{TEAM_LABELS[team]}</PixelText>
      {mine && <PixelText>Você</PixelText>}
    </div>
  );
}
