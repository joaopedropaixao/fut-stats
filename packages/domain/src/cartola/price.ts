import { DEFAULT_CARTOLA_PRICE, roundTo2, type CartolaPriceConfig } from './config';

export interface PriceVariation {
  /** Pontos que o preço "pedia": preço × k. */
  expected: number;
  /** Quanto o preço mudou de fato (já com limite e preço mínimo). */
  variation: number;
  newPrice: number;
}

/**
 * Valorização do jogador após a rodada.
 * - `price` é gerado pelo sistema (preço inicial ou saída desta função), por isso não é validado aqui.
 * - `points` é a pontuação do jogador **sem** o multiplicador de capitão (o preço é do jogador, não da
 *   escalação de alguém); `null` quando ele não jogou, e aí o preço fica congelado.
 */
export function priceVariation(
  price: number,
  points: number | null,
  config: Partial<CartolaPriceConfig> = {},
): PriceVariation {
  const { k, factor, maxChangeRatio, minPrice } = { ...DEFAULT_CARTOLA_PRICE, ...config };
  const expected = roundTo2(price * k);
  if (points === null) return { expected, variation: 0, newPrice: price };

  const limit = price * maxChangeRatio;
  const raw = (points - price * k) * factor;
  const clamped = Math.min(limit, Math.max(-limit, raw));
  const newPrice = roundTo2(Math.max(minPrice, price + clamped));

  return { expected, variation: roundTo2(newPrice - price), newPrice };
}
