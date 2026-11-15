/** Faixa da carta no pacote do Craque. Textos e cores em `apps/web`. */
export type CardTier = 'bronze' | 'silver' | 'gold';

/** Notas mínimas de cada faixa: abaixo de `silver` é bronze. */
export interface CardTierCuts {
  /** Nota mínima da prata. */
  silver: number;
  /** Nota mínima do ouro. */
  gold: number;
}

/** Bronze < 6, prata de 6 a 7,9, ouro a partir de 8. */
export const DEFAULT_CARD_TIER_CUTS: CardTierCuts = { silver: 6, gold: 8 };

/**
 * Faixa da carta pela nota da rodada. A nota vem com uma casa (`roundScore`), então comparar com `>=` direto é
 * seguro. Quem não tem nota (`null`) não tem faixa: o chamador nem chama.
 */
export function cardTier(rating: number, cuts: CardTierCuts = DEFAULT_CARD_TIER_CUTS): CardTier {
  if (rating >= cuts.gold) return 'gold';
  if (rating >= cuts.silver) return 'silver';
  return 'bronze';
}
