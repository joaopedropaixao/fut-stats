import { DEFAULT_CARTOLA_PRICE, roundTo2, type CartolaPriceConfig } from './config';

export interface PriceVariation {
  /** Pontos que o preço "pedia": preço × k. */
  expected: number;
  /** Quanto o preço mudou de fato (já com limite e preço mínimo). */
  variation: number;
  newPrice: number;
}

/**
 * Valorização do jogador após a rodada. `points` é a pontuação do jogador sem o
 * multiplicador de capitão (o preço é do jogador, não da escalação de alguém).
 */
export function priceVariation(
  price: number,
  points: number,
  config: Partial<CartolaPriceConfig> = {},
): PriceVariation {
  if (!Number.isFinite(price) || price <= 0) {
    throw new RangeError(`Preço inválido: ${price}`);
  }
  const { k, factor, maxChangeRatio, minPrice } = { ...DEFAULT_CARTOLA_PRICE, ...config };

  const expected = price * k;
  const limit = price * maxChangeRatio;
  const raw = (points - expected) * factor;
  const clamped = Math.min(limit, Math.max(-limit, raw));
  const newPrice = roundTo2(Math.max(minPrice, price + clamped));

  return { expected: roundTo2(expected), variation: roundTo2(newPrice - price), newPrice };
}
