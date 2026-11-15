import type { CardTier } from '@fut-stats/shared';

/** A faixa por extenso: cor nunca é o único sinal. */
export const TIER_LABELS: Readonly<Record<CardTier, string>> = {
  bronze: 'Bronze',
  silver: 'Prata',
  gold: 'Ouro',
};

/** Cores do canvas do Compartilhar (a mesma família dos gradientes de `index.css`). */
export const TIER_COLORS: Readonly<
  Record<CardTier, { from: string; mid: string; to: string; ink: string }>
> = {
  gold: { from: '#f6d77a', mid: '#e8a93a', to: '#fbe7a8', ink: '#111111' },
  silver: { from: '#f4f7fa', mid: '#a9b4bf', to: '#e6ecf1', ink: '#111111' },
  bronze: { from: '#efbf93', mid: '#b8703f', to: '#e8b283', ink: '#130a03' },
};
