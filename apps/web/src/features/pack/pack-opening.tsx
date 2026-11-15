import type { RoundResult } from '@fut-stats/shared';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { PixelText } from '../../components/ui/pixel-text';
import { Button } from '../../components/ui/button';
import { cn } from '../../lib/cn';
import { CraqueCard } from '../voting/craque-card';
import { buildDeck, type PackCard } from './deck';
import { buildFrames, clueTimes, cluesAt, frameDuration, type Frame } from './frames';
import { FlopPackCard, MinePackCard } from './pack-cards';
import { frameAnnouncement } from './pack-text';
import { BurstSprite, PackBody, PackFlap, PackSprite, StarSprite } from './pack-sprites';
import { ShareButton } from './share-button';

type PackOpeningProps = {
  result: RoundResult;
  /** O pacote chegou ao fim (as cartas finais) ou foi pulado: é aqui que "já abri" é marcado. */
  onFinish: () => void;
  /** "Ver o resultado": o pacote sai e a página do resultado aparece. */
  onDone: () => void;
};

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * O pacote do Craque (folha: Momento/Pacote): o pacote fechado espera o toque; depois treme, rasga e solta a luz;
 * saem as cartas, uma por quadro (o Craque faz o walkout em degraus, depois o Perna de Pau, depois a sua), e as
 * cartas finais ficam lado a lado com Compartilhar. Até ~2 s por carta, o toque adianta, "Pular" sempre leva ao
 * fim. Com "reduzir movimento" o pacote toca e as cartas finais entram com um fade. A animação é decorativa
 * (aria-hidden); cada carta é anunciada em texto e o foco vai para o título das cartas finais.
 */
export default function PackOpening({ result, onFinish, onDone }: PackOpeningProps) {
  const deck = useMemo(() => buildDeck(result), [result]);
  const [reduced] = useState(prefersReducedMotion);
  const frames = useMemo<Frame[]>(() => {
    const all = buildFrames(deck);
    return reduced ? [all[0]!, all[all.length - 1]!] : all;
  }, [deck, reduced]);
  const [index, setIndex] = useState(0);
  const frame = frames[index]!;
  const last = frames.length - 1;
  const heading = useRef<HTMLHeadingElement>(null);
  const root = useRef<HTMLElement>(null);
  // Em que quadro o rosto do Craque já apareceu (para o leitor de tela anunciar só então)
  const [faceAt, setFaceAt] = useState(-1);

  // O quadro começa no topo da tela: o "Pular" e a carta ficam acima da barra de baixo, mesmo em tela baixa
  useEffect(() => {
    root.current?.scrollIntoView({ block: 'start' });
  }, []);

  // Cada quadro segue sozinho depois do seu tempo; fechado e final esperam
  useEffect(() => {
    const ms = frameDuration(frame);
    if (ms === null) return;
    const timer = setTimeout(() => setIndex((i) => Math.min(i + 1, last)), ms);
    return () => clearTimeout(timer);
  }, [frame, last]);

  const atEnd = index === last;
  useEffect(() => {
    if (!atEnd) return;
    onFinish();
    heading.current?.focus({ preventScroll: true });
  }, [atEnd, onFinish]);

  const advance = () => setIndex((i) => Math.min(i + 1, last));
  const announcement =
    frame.kind === 'card' ? frameAnnouncement(frame.card, faceAt === index, result.number) : '';

  return (
    <section
      ref={root}
      aria-label={`Pacote da rodada ${result.number}`}
      className="relative scroll-mt-3"
    >
      <p role="status" className="sr-only">
        {announcement}
      </p>
      {atEnd ? (
        <Finals
          deck={deck}
          roundNumber={result.number}
          heading={heading}
          onDone={onDone}
          reduced={reduced}
        />
      ) : (
        <div
          className={cn(
            'moment-frame animate-moment-in relative flex min-h-[440px] items-center justify-center overflow-hidden bg-track px-3 pt-20 pb-6',
            frame.kind !== 'closed' && 'cursor-pointer',
          )}
          style={{
            backgroundImage:
              'radial-gradient(220px 200px at 50% 45%, rgb(232 169 58 / 28%) 0, transparent 200px)',
          }}
          onClick={frame.kind === 'closed' ? undefined : advance}
        >
          <Stage
            key={index}
            frame={frame}
            number={result.number}
            onOpen={advance}
            onFace={() => setFaceAt(index)}
          />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIndex(last);
            }}
            className="absolute top-4 left-4 z-20 inline-flex min-h-11 min-w-11 items-center bg-team-black px-4 text-team-white shadow-[inset_0_0_0_2px_rgb(255_255_255/35%)] focus-visible:shadow-[inset_0_0_0_2px_rgb(255_255_255/35%),0_0_0_2px_var(--color-team-black)] active:bg-surface-3"
          >
            <PixelText>Pular</PixelText>
          </button>
        </div>
      )}
    </section>
  );
}

function Stage({
  frame,
  number,
  onOpen,
  onFace,
}: {
  frame: Frame;
  number: number;
  onOpen: () => void;
  onFace: () => void;
}) {
  switch (frame.kind) {
    case 'closed':
      return <ClosedPack number={number} onOpen={onOpen} />;
    case 'shake':
      return (
        <div aria-hidden className="animate-pack-shake">
          <PackWithLabel number={number} />
        </div>
      );
    case 'tear':
      return <Tear number={number} />;
    case 'card':
      return frame.card.kind === 'craque' ? (
        <Walkout card={frame.card} number={number} onFace={onFace} />
      ) : frame.card.kind === 'flop' ? (
        <div aria-hidden className="animate-pack-drop">
          <FlopPackCard
            player={frame.card.player}
            tier={frame.card.tier}
            you={frame.card.you}
            hidden
          />
        </div>
      ) : (
        <div aria-hidden className="animate-pack-flip">
          <MinePackCard
            player={frame.card.player}
            tier={frame.card.tier}
            rank={frame.card.rank}
            hidden
          />
        </div>
      );
    case 'duo':
      // As duas cartas encolhidas (0,7; 0,6 em 320) para caber lado a lado a partir de 360 px; em 320 ficam empilhadas
      return (
        <div
          aria-hidden
          className="animate-final-in flex flex-wrap items-center justify-center gap-x-3 gap-y-3 max-[359px]:flex-col"
        >
          {frame.cards.map((c) => (
            <div
              key={c.player.membershipId}
              className="h-[173px] w-[115px] min-[360px]:h-[202px] min-[360px]:w-[134px]"
            >
              <div className="w-48 origin-top-left scale-[0.6] min-[360px]:scale-[0.7]">
                <CraqueCard
                  player={c.player}
                  tier={c.tier}
                  roundNumber={number}
                  special={c.you}
                  hidden
                />
              </div>
            </div>
          ))}
        </div>
      );
    case 'final':
      return null;
  }
}

/** O pacote fechado: o botão que abre ("Abrir o pacote da rodada 12"), em ouro. */
function ClosedPack({ number, onOpen }: { number: number; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Abrir o pacote da rodada ${number}`}
      className="flex min-h-11 flex-col items-center gap-4 outline-offset-8"
    >
      <span aria-hidden className="animate-moment-in">
        <PackWithLabel number={number} />
      </span>
      <PixelText wrap className="text-center text-text-muted">
        Toque para abrir
      </PixelText>
    </button>
  );
}

/** O pacote com o rótulo em cima do corpo: CRAQUE e RODADA 12 em tinta escura. */
function PackWithLabel({ number }: { number: number }) {
  return (
    <div className="relative w-44">
      <PackSprite />
      <PackLabel number={number} />
    </div>
  );
}

function PackLabel({ number }: { number: number }) {
  return (
    <div className="absolute inset-x-0 top-[132px] flex flex-col items-center gap-0.5 text-on-accent">
      <PixelText>Craque</PixelText>
      <PixelText>{`Rodada ${number}`}</PixelText>
    </div>
  );
}

/** Rasgo: a tampa sai girando, a luz vaza em faixas pixel pela fenda e os raios abrem atrás. */
function Tear({ number }: { number: number }) {
  const rays = [
    { left: 18, h: 120, delay: 0 },
    { left: 52, h: 170, delay: 60 },
    { left: 88, h: 210, delay: 20 },
    { left: 124, h: 160, delay: 100 },
    { left: 154, h: 110, delay: 40 },
  ];
  return (
    <div aria-hidden className="relative h-[224px] w-44">
      <div className="animate-pack-burst absolute -top-8 left-1/2 -ml-24 opacity-70">
        <BurstSprite />
      </div>
      {rays.map((ray) => (
        <span
          key={ray.left}
          style={
            { left: ray.left, height: ray.h, '--moment-delay': `${ray.delay}ms` } as CSSProperties
          }
          className="animate-pack-light absolute bottom-[176px] w-3 bg-gold-light shadow-[0_0_0_2px_var(--color-text)]"
        />
      ))}
      <PackFlap className="animate-pack-flap absolute top-0 left-0" />
      <PackBody className="absolute top-12 left-0" />
      <PackLabel number={number} />
    </div>
  );
}

/** Palco do Craque: o walkout. A carta apagada acende em degraus; no rosto, flash, estrelas e confete. */
function Walkout({ card, number, onFace }: { card: PackCard; number: number; onFace: () => void }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const timers = clueTimes(card.score).map((t) => setTimeout(() => setElapsed(t), t));
    return () => timers.forEach(clearTimeout);
  }, [card.score]);
  const clues = cluesAt(elapsed, card.score);
  const special = card.you;

  useEffect(() => {
    if (!clues.face) return;
    try {
      navigator.vibrate?.(special ? [40, 60, 40] : 40);
    } catch {
      // sem vibração neste aparelho
    }
  }, [clues.face, special]);

  // Avisa o pacote uma vez, quando o rosto aparece (o leitor de tela anuncia a carta só então)
  const faceCallback = useRef(onFace);
  useEffect(() => {
    faceCallback.current = onFace;
  });
  useEffect(() => {
    if (clues.face) faceCallback.current();
  }, [clues.face]);

  return (
    <div aria-hidden className="relative flex items-center justify-center">
      {clues.face && (
        <>
          <div className="animate-pack-burst absolute -z-0 opacity-80">
            <BurstSprite scale={special ? 16 : 14} />
          </div>
          <Sparkles special={special} />
        </>
      )}
      <CraqueCard
        player={card.player}
        tier={card.tier}
        roundNumber={number}
        special={special}
        clues={clues}
        hidden
        className="relative z-10"
      >
        {clues.face && (
          <>
            <span className="animate-pack-flash absolute inset-0 bg-team-white" />
            {special && (
              <span
                style={{ '--moment-delay': '300ms' } as CSSProperties}
                className="animate-pack-flash absolute inset-0 bg-team-white"
              />
            )}
          </>
        )}
      </CraqueCard>
    </div>
  );
}

/** Estrelas e confete pixel da revelação do Craque; sendo você, o dobro. */
const SPARKS = [
  { x: -118, y: -150, s: 4, c: 'var(--color-gold-light)', d: 0 },
  { x: 100, y: -140, s: 3, c: 'var(--color-text)', d: 80 },
  { x: -130, y: 10, s: 3, c: 'var(--color-text)', d: 160 },
  { x: 126, y: 30, s: 4, c: 'var(--color-gold-light)', d: 40 },
  { x: -96, y: 150, s: 3, c: 'var(--color-gold-light)', d: 120 },
  { x: 90, y: 160, s: 3, c: 'var(--color-text)', d: 200 },
] as const;

const SPARKS_EXTRA = [
  { x: -60, y: -170, s: 3, c: 'var(--color-text)', d: 260 },
  { x: 40, y: -176, s: 4, c: 'var(--color-gold-light)', d: 320 },
  { x: -146, y: -70, s: 3, c: 'var(--color-gold-light)', d: 220 },
  { x: 142, y: -60, s: 3, c: 'var(--color-text)', d: 280 },
  { x: -150, y: 90, s: 4, c: 'var(--color-text)', d: 300 },
  { x: 150, y: 110, s: 3, c: 'var(--color-gold-light)', d: 240 },
] as const;

const CONFETTI = [
  { x: 8, c: 'bg-gold', s: 10, dx: 10, d: 0, t: 1300 },
  { x: 16, c: 'bg-team-white', s: 8, dx: -8, d: 120, t: 1500 },
  { x: 24, c: 'bg-success', s: 10, dx: 14, d: 40, t: 1200 },
  { x: 33, c: 'bg-game', s: 8, dx: -12, d: 260, t: 1400 },
  { x: 42, c: 'bg-gold', s: 8, dx: 8, d: 180, t: 1100 },
  { x: 51, c: 'bg-team-white', s: 10, dx: -6, d: 60, t: 1500 },
  { x: 60, c: 'bg-success', s: 8, dx: 12, d: 300, t: 1300 },
  { x: 69, c: 'bg-game', s: 10, dx: -10, d: 20, t: 1400 },
  { x: 78, c: 'bg-gold', s: 8, dx: 6, d: 220, t: 1200 },
  { x: 87, c: 'bg-team-white', s: 8, dx: -14, d: 100, t: 1500 },
  { x: 94, c: 'bg-success', s: 10, dx: 10, d: 340, t: 1100 },
  { x: 12, c: 'bg-game', s: 10, dx: -8, d: 400, t: 1300 },
  { x: 29, c: 'bg-team-white', s: 8, dx: 12, d: 440, t: 1400 },
  { x: 47, c: 'bg-gold', s: 10, dx: -10, d: 380, t: 1200 },
  { x: 64, c: 'bg-success', s: 8, dx: 6, d: 460, t: 1500 },
  { x: 82, c: 'bg-game', s: 10, dx: -6, d: 420, t: 1100 },
] as const;

function Sparkles({ special }: { special: boolean }) {
  const sparks = special ? [...SPARKS, ...SPARKS_EXTRA] : SPARKS;
  const confetti = special ? CONFETTI : CONFETTI.slice(0, 8);
  return (
    <>
      {sparks.map((s, i) => (
        <span
          key={i}
          style={
            {
              transform: `translate(${s.x}px, ${s.y}px)`,
              '--moment-delay': `${s.d}ms`,
            } as CSSProperties
          }
          className="absolute"
        >
          <span
            className="animate-star-twinkle inline-flex"
            style={{ '--moment-delay': `${s.d}ms` } as CSSProperties}
          >
            <StarSprite scale={s.s} color={s.c} />
          </span>
        </span>
      ))}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-28 left-1/2 z-0 h-[520px] w-[640px] -translate-x-1/2 overflow-hidden"
      >
        <div className="relative h-full w-full">
          {confetti.map((p, i) => (
            <span
              key={i}
              style={
                {
                  left: `${p.x}%`,
                  width: p.s,
                  height: p.s,
                  '--dx': `${p.dx}px`,
                  '--dur': `${p.t}ms`,
                  '--moment-delay': `${p.d}ms`,
                } as CSSProperties
              }
              className={cn('animate-confetti-fall absolute top-0', p.c)}
            />
          ))}
        </div>
      </div>
    </>
  );
}

/** As cartas finais: as duas ou três lado a lado (empilhadas em tela estreita), Compartilhar e "Ver o resultado". */
function Finals({
  deck,
  roundNumber,
  heading,
  onDone,
  reduced,
}: {
  deck: PackCard[];
  roundNumber: number;
  heading: RefObject<HTMLHeadingElement | null>;
  onDone: () => void;
  reduced: boolean;
}) {
  return (
    <div
      className={cn(
        'moment-frame flex flex-col items-center gap-6 bg-track px-3 py-6',
        reduced ? 'animate-vs-fade' : 'animate-moment-in',
      )}
    >
      <h2
        ref={heading}
        tabIndex={-1}
        className="flex flex-col items-center gap-1 text-center outline-none"
      >
        <span className="sr-only">{`Cartas da rodada ${roundNumber}`}</span>
        <span aria-hidden className="flex flex-col items-center gap-1">
          <PixelText size={24} wrap>
            Cartas do pacote
          </PixelText>
          <PixelText className="text-gold">{`Rodada ${roundNumber}`}</PixelText>
        </span>
      </h2>
      <div className="flex w-full flex-wrap items-start justify-center gap-x-5 gap-y-6">
        {deck.map((c, i) => (
          <FinalCard key={c.player.membershipId} card={c} number={roundNumber} delay={i * 140} />
        ))}
      </div>
      <Button label="Ver o resultado" onClick={onDone} block />
    </div>
  );
}

function FinalCard({ card, number, delay }: { card: PackCard; number: number; delay: number }) {
  const style = { '--moment-delay': `${delay}ms` } as CSSProperties;
  return (
    <div
      style={style}
      className="animate-final-in flex w-48 max-w-full flex-col items-center gap-4"
    >
      {card.kind === 'craque' ? (
        <CraqueCard player={card.player} tier={card.tier} roundNumber={number} special={card.you} />
      ) : card.kind === 'flop' ? (
        <FlopPackCard player={card.player} tier={card.tier} you={card.you} />
      ) : (
        <MinePackCard player={card.player} tier={card.tier} rank={card.rank} />
      )}
      {card.kind !== 'flop' && <ShareButton card={card} roundNumber={number} block />}
    </div>
  );
}
