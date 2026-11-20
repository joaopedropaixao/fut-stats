import {
  cardTier,
  POSITION_LABELS,
  TEAM_LABELS,
  type CardTier,
  type ResultPlayer,
} from '@fut-stats/shared';
import type { CSSProperties, ReactNode } from 'react';
import { PixelBodyLarge } from '../../components/ui/pixel-body-large';
import { PixelDigits } from '../../components/ui/pixel-digits';
import { PixelText } from '../../components/ui/pixel-text';
import { FlopPackCard } from '../../features/pack/pack-cards';
import { player } from '../../features/pack/fixtures';
import { TierSeal } from '../../features/pack/flop-sprites';
import { TIER_LABELS } from '../../features/pack/tier';
import { cn } from '../../lib/cn';
import { formatRating } from '../../lib/rating-format';
import './craque-frames.css';
import { CORNER, SPARK, SPIKE, STAR, TROPHY, WING } from './craque-sprite-maps';
import { Px } from './craque-sprites';

/**
 * Molduras do Craque, só em dev (`/dev/craque`): três propostas de moldura sobre o fundo dourado brilhante, cada uma
 * nas notas 5,8 / 7,2 / 9,1, com a carta atual do Perna de Pau ao lado para comparar. A moldura é igual nas três
 * notas; só o selo da faixa muda (escuro, para não sumir no dourado). O que o dono não escolher sai depois.
 */
type Variant = 'a' | 'b' | 'c';

const VARIANTS: { id: Variant; title: string; blurb: string }[] = [
  {
    id: 'a',
    title: 'A · Troféu',
    blurb:
      'Ouro velho grosso, com bisel e friso, cantoneiras em L com rebite e um troféu grande em cima da carta.',
  },
  {
    id: 'b',
    title: 'B · Coroa de estrelas',
    blurb:
      'Ouro polido com friso duplo, estrelas pixel ao longo da borda, raios saindo de trás do jogador e o troféu na beirada de cima.',
  },
  {
    id: 'c',
    title: 'C · Lenda',
    blurb:
      'Cantos em degraus, ponteiras nos cantos de cima, troféu com asas, faíscas em volta e dois brilhos fortes passando.',
  },
];

const CRAQUES: {
  score: number;
  nickname: string;
  team: 'WHITE' | 'BLACK';
  position: ResultPlayer['position'];
  goals: number;
  assists: number;
}[] = [
  { score: 5.8, nickname: 'Rafa', team: 'WHITE', position: 'MIDFIELDER', goals: 1, assists: 0 },
  { score: 7.2, nickname: 'Diegão', team: 'BLACK', position: 'DEFENDER', goals: 0, assists: 1 },
  { score: 9.1, nickname: 'Felipinho', team: 'WHITE', position: 'FORWARD', goals: 3, assists: 1 },
];

const FLOP = {
  ...player('flop', 'Dudu', 5.7),
  team: 'BLACK' as const,
  position: 'DEFENDER' as const,
};

const seed = (ms: number) => ({ '--moment-delay': `${ms}ms` }) as CSSProperties;

/** Faísca que paira em volta e pisca em degraus (parada com Reduzir movimento). */
function Spark({ className, delay = 0 }: { className: string; delay?: number }) {
  return (
    <Px
      map={SPARK}
      scale={3}
      className={cn('animate-star-twinkle pointer-events-none absolute', className)}
      style={seed(delay)}
    />
  );
}

/** O miolo dourado, igual nas três molduras: tira do time, nota, posição, bonequinho, nomes. */
function Face({
  c,
  roundNumber,
  behind,
  strong,
}: {
  c: ResultPlayer;
  roundNumber: number;
  behind?: ReactNode;
  strong?: boolean;
}) {
  const white = c.team === 'WHITE';
  return (
    <div className="lab-face lab-gold relative flex min-h-[308px] flex-1 flex-col justify-between gap-2 overflow-hidden pb-3 text-(--ink)">
      {behind}
      <Spark className="top-[66px] right-[92px]" delay={300} />
      <Spark className="bottom-[84px] left-[104px]" delay={650} />
      <div
        className={cn(
          'relative flex h-[30px] shrink-0 items-center px-3',
          white
            ? 'bg-team-white text-team-black shadow-[inset_0_-3px_0_0_#000]'
            : 'bg-team-black text-team-white shadow-[inset_0_-3px_0_0_rgb(255_255_255/35%)]',
        )}
      >
        <PixelText>{TEAM_LABELS[c.team]}</PixelText>
      </div>
      <div className="relative flex flex-col gap-1 px-3">
        <PixelDigits
          value={formatRating(c.score!)}
          scale={4}
          label={`Nota ${formatRating(c.score!)}`}
        />
        <PixelText className="text-(--ink-2)">{POSITION_LABELS[c.position]}</PixelText>
      </div>
      <div className="relative flex items-center justify-between px-3">
        <div className="flex flex-col gap-1.5">
          <span className="inline-flex h-6 items-center self-start bg-(--ink) px-2 text-team-white">
            <PixelText>{`${c.goals} ${c.goals === 1 ? 'gol' : 'gols'}`}</PixelText>
          </span>
          <span className="inline-flex h-6 items-center self-start bg-(--ink) px-2 text-team-white">
            <PixelText>{`${c.assists} assist.`}</PixelText>
          </span>
        </div>
        <span aria-hidden className="flex">
          <PixelBodyLarge team={white ? 'white' : 'black'} avatar={c.avatar} scale={3} />
        </span>
      </div>
      <div className="relative flex flex-col gap-0.5 px-3">
        <PixelText wrap className="text-(--ink)">
          {c.nickname}
        </PixelText>
        <PixelText wrap className="text-(--ink-2)">
          Craque
        </PixelText>
        <PixelText wrap className="text-(--ink-2)">{`Rodada ${roundNumber}`}</PixelText>
      </div>
      <i className={cn('lab-sweep', strong && 'lab-sweep-strong')} aria-hidden />
      {strong && <i className="lab-sweep lab-sweep-strong lab-sweep-late" aria-hidden />}
    </div>
  );
}

function Seal({ tier, className }: { tier: CardTier; className?: string }) {
  return (
    <TierSeal
      dark
      label={TIER_LABELS[tier]}
      className={cn('absolute origin-top-left rotate-[6deg]', className)}
    />
  );
}

const CORNERS: { pos: string; flip: string }[] = [
  { pos: 'top-[2px] left-[2px]', flip: '' },
  { pos: 'top-[2px] right-[2px]', flip: '[transform:scaleX(-1)]' },
  { pos: 'bottom-[2px] left-[2px]', flip: '[transform:scaleY(-1)]' },
  { pos: 'right-[2px] bottom-[2px]', flip: '[transform:scale(-1,-1)]' },
];

/** A) Troféu */
function FrameA({ c, roundNumber }: { c: ResultPlayer; roundNumber: number }) {
  const tier = cardTier(c.score!);
  return (
    <div data-tier={tier} className="lab-card relative w-60 max-w-full -rotate-[3deg] pt-[68px]">
      <Px
        map={TROPHY}
        scale={4}
        className="pointer-events-none absolute top-0 left-1/2 z-10 -translate-x-1/2 drop-shadow-[0_4px_0_rgb(0_0_0/45%)]"
      />
      <div className="lab-frame-a relative flex p-4">
        <i className="lab-friso inset-[7px]" aria-hidden />
        <Face c={c} roundNumber={roundNumber} />
        {CORNERS.map((k) => (
          <Px
            key={k.pos}
            map={CORNER}
            scale={3}
            className={cn('pointer-events-none absolute', k.pos, k.flip)}
          />
        ))}
        <Seal tier={tier} className="-right-[12px] top-[44px]" />
      </div>
      <Spark className="top-6 left-4" delay={200} />
      <Spark className="top-12 -right-9" delay={520} />
      <Spark className="-bottom-4 left-12" delay={760} />
    </div>
  );
}

/** B) Coroa de estrelas */
function FrameB({ c, roundNumber }: { c: ResultPlayer; roundNumber: number }) {
  const tier = cardTier(c.score!);
  const row = (n: number) => Array.from({ length: n }, (_, i) => i);
  return (
    <div data-tier={tier} className="lab-card relative mt-9 w-60 max-w-full -rotate-[3deg]">
      <div className="lab-frame-b relative flex p-[24px]">
        <i className="lab-friso inset-[4px]" aria-hidden />
        <i className="lab-friso-lt inset-[20px]" aria-hidden />
        {/* Estrelas ao longo da borda */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-8 top-[3px] flex justify-between"
        >
          {row(5).map((i) => (
            <Px key={i} map={STAR} scale={2} className={i === 2 || i === 3 ? 'invisible' : ''} />
          ))}
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-8 bottom-[3px] flex justify-between"
        >
          {row(5).map((i) => (
            <Px key={i} map={STAR} scale={2} />
          ))}
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-10 left-[3px] flex flex-col justify-between"
        >
          {row(6).map((i) => (
            <Px key={i} map={STAR} scale={2} />
          ))}
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-10 right-[3px] flex flex-col justify-between"
        >
          {row(6).map((i) => (
            <Px key={i} map={STAR} scale={2} />
          ))}
        </div>
        <Face c={c} roundNumber={roundNumber} behind={<i className="lab-rays" aria-hidden />} />
        <Seal tier={tier} className="-right-[12px] top-[52px]" />
      </div>
      <Spark className="-top-8 left-3" delay={100} />
      <Spark className="top-24 -right-8" delay={420} />
      <Spark className="-bottom-3 left-10" delay={700} />
      <Px
        map={TROPHY}
        scale={3}
        className="pointer-events-none absolute -top-[34px] left-1/2 z-10 -translate-x-1/2 drop-shadow-[0_3px_0_rgb(0_0_0/45%)]"
      />
    </div>
  );
}

/** C) Lenda */
function FrameC({ c, roundNumber }: { c: ResultPlayer; roundNumber: number }) {
  const tier = cardTier(c.score!);
  return (
    <div data-tier={tier} className="lab-card relative w-60 max-w-full -rotate-[3deg] pt-[54px]">
      <Px
        map={WING}
        scale={4}
        className="pointer-events-none absolute top-[4px] left-[calc(50%-24px-56px)] z-10"
      />
      <Px
        map={WING}
        scale={4}
        className="pointer-events-none absolute top-[4px] left-[calc(50%+24px)] z-10 [transform:scaleX(-1)]"
      />
      <Px
        map={TROPHY}
        scale={3}
        className="pointer-events-none absolute top-0 left-1/2 z-10 -translate-x-1/2 drop-shadow-[0_3px_0_rgb(0_0_0/45%)]"
      />
      <div className="lab-outline-c relative">
        <div className="lab-frame-c relative flex p-[20px]">
          <i className="lab-friso inset-[8px]" aria-hidden />
          <i className="lab-friso-lt inset-[13px]" aria-hidden />
          <Face c={c} roundNumber={roundNumber} strong />
        </div>
      </div>
      <Px
        map={SPIKE}
        scale={3}
        className="pointer-events-none absolute top-[34px] -left-[10px] z-10 [transform:rotate(-14deg)]"
      />
      <Px
        map={SPIKE}
        scale={3}
        className="pointer-events-none absolute top-[34px] -right-[10px] z-10 [transform:rotate(14deg)]"
      />
      <Seal tier={tier} className="-right-[12px] top-[96px]" />
      <Spark className="-top-1 left-2" delay={0} />
      <Spark className="top-16 -left-7" delay={250} />
      <Spark className="top-[46%] -right-7" delay={500} />
      <Spark className="bottom-10 -left-6" delay={150} />
      <Spark className="-bottom-3 right-8" delay={400} />
      <Spark className="top-4 right-0" delay={600} />
    </div>
  );
}

const FRAMES = { a: FrameA, b: FrameB, c: FrameC } as const;

export function CraqueFramesPage() {
  return (
    <main className="mx-auto flex max-w-[1180px] flex-col gap-14 px-4 py-8">
      <title>Moldura do Craque (dev) · Fut Stats</title>
      <header className="flex flex-col gap-2">
        <PixelText as="h1" size={24} wrap>
          Moldura do Craque
        </PixelText>
        <p className="max-w-prose text-sm text-text-muted">
          Só em dev. Três molduras sobre o fundo dourado brilhante, nas notas 5,8 / 7,2 / 9,1, com a
          carta atual do Perna de Pau ao lado. A moldura é a mesma nas três notas; só o selo da
          faixa muda. Com Reduzir movimento, o brilho não passa.
        </p>
      </header>
      {VARIANTS.map((v) => {
        const Frame = FRAMES[v.id];
        return (
          <section key={v.id} id={`opcao-${v.id}`} className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
              <PixelText as="h2" size={24} wrap className="text-gold">
                {v.title}
              </PixelText>
              <p className="max-w-prose text-sm text-text-muted">{v.blurb}</p>
            </div>
            <div className="flex flex-wrap items-end justify-center gap-x-12 gap-y-16 px-3 pb-12">
              {CRAQUES.map((c, i) => (
                <Frame
                  key={c.score}
                  c={{ ...player(`c${i}`, c.nickname, c.score), ...c }}
                  roundNumber={8}
                />
              ))}
              <div className="flex flex-col items-center gap-3">
                <PixelText className="text-flop">Perna de pau atual</PixelText>
                <FlopPackCard player={FLOP} tier={cardTier(FLOP.score!)} phrase="O pé tava torto" />
              </div>
            </div>
          </section>
        );
      })}
    </main>
  );
}
