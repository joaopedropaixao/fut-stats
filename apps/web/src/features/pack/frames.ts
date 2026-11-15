import type { PackCard } from './deck';
import { ratingSteps } from './rating-steps';

/** Os quadros do pacote, na ordem: o fechado espera o toque; o final fica parado. */
export type Frame =
  | { kind: 'closed' }
  | { kind: 'shake' }
  | { kind: 'tear' }
  /** `hold`: o Craque revelado fica mais tempo para ler (quem abre não é o Craque nem o Perna de Pau). */
  | { kind: 'card'; card: PackCard; hold?: boolean }
  /** Empate de Craque: as duas cartas juntas, depois de cada uma fazer o seu walkout. */
  | { kind: 'duo'; cards: PackCard[]; hold?: boolean }
  | { kind: 'final' };

/**
 * Duração de cada quadro (ms), do toque até passar para o próximo sozinho. O Craque fica ~3 s; a carta sua (o
 * Craque "VOCÊ" ou você sendo o Perna de Pau) segura ~4 s, a festa ou a piada; as outras, ~2 s. Quando quem abre
 * não é o Craque nem o Perna de Pau, o Craque revelado segura mais `readHold` para dar tempo de ler gols,
 * assistências e a frase (no empate, o quadro das duas cartas juntas).
 */
export const FRAME_MS = {
  shake: 700,
  tear: 600,
  craque: 3000,
  craqueYou: 4000,
  duo: 1600,
  flop: 2000,
  flopYou: 4000,
  mine: 2000,
  readHold: 2500,
} as const;

export function buildFrames(deck: readonly PackCard[]): Frame[] {
  const craques = deck.filter((c) => c.kind === 'craque');
  const rest = deck.filter((c) => c.kind !== 'craque');
  // Quem abre não é o Craque nem o Perna de Pau: o Craque revelado fica mais tempo para ler
  const hold = !deck.some((c) => (c.kind === 'craque' || c.kind === 'flop') && c.you);
  const tie = craques.length > 1;
  return [
    { kind: 'closed' },
    { kind: 'shake' },
    { kind: 'tear' },
    ...craques.map((card): Frame => ({ kind: 'card', card, hold: hold && !tie })),
    ...(tie ? [{ kind: 'duo', cards: craques, hold } as Frame] : []),
    ...rest.map((card): Frame => ({ kind: 'card', card })),
    { kind: 'final' },
  ];
}

/** Quanto o quadro dura até seguir sozinho; `null` espera o toque (fechado) ou fica parado (final). */
export function frameDuration(frame: Frame): number | null {
  switch (frame.kind) {
    case 'closed':
    case 'final':
      return null;
    case 'shake':
      return FRAME_MS.shake;
    case 'tear':
      return FRAME_MS.tear;
    case 'duo':
      return FRAME_MS.duo + (frame.hold ? FRAME_MS.readHold : 0);
    case 'card': {
      const { kind, you } = frame.card;
      if (kind === 'craque')
        return you ? FRAME_MS.craqueYou : FRAME_MS.craque + (frame.hold ? FRAME_MS.readHold : 0);
      if (kind === 'flop') return you ? FRAME_MS.flopYou : FRAME_MS.flop;
      return FRAME_MS.mine;
    }
  }
}

/** O walkout do Craque, em degraus: a cor do time, a posição, a nota subindo e só então o rosto. */
export const WALKOUT_AT = {
  team: 150,
  position: 700,
  rating: 1150,
  ratingStep: 140,
  face: 2000,
} as const;

export type Clues = {
  team: boolean;
  position: boolean;
  /** A nota que aparece agora (um degrau); `null` antes de a nota começar. */
  rating: number | null;
  face: boolean;
};

/** As pistas visíveis depois de `elapsed` ms do começo do walkout. */
export function cluesAt(elapsed: number, score: number): Clues {
  const steps = ratingSteps(score);
  const index = Math.min(
    steps.length - 1,
    Math.floor((elapsed - WALKOUT_AT.rating) / WALKOUT_AT.ratingStep),
  );
  return {
    team: elapsed >= WALKOUT_AT.team,
    position: elapsed >= WALKOUT_AT.position,
    rating: elapsed >= WALKOUT_AT.rating ? steps[Math.max(0, index)]! : null,
    face: elapsed >= WALKOUT_AT.face,
  };
}

/** Os instantes em que as pistas mudam (para o relógio do walkout acordar só neles). */
export function clueTimes(score: number): number[] {
  const steps = ratingSteps(score);
  return [
    WALKOUT_AT.team,
    WALKOUT_AT.position,
    ...steps.map((_, i) => WALKOUT_AT.rating + i * WALKOUT_AT.ratingStep),
    WALKOUT_AT.face,
  ].sort((a, b) => a - b);
}

/** Todas as pistas (a carta pronta). */
export const ALL_CLUES = (score: number): Clues => ({
  team: true,
  position: true,
  rating: score,
  face: true,
});
