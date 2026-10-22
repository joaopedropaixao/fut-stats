/** Pesos da pontuação do Cartola da pelada. Ficam na configuração do grupo. */
export interface CartolaScoringConfig {
  goal: number;
  assist: number;
  win: number;
  draw: number;
  mvp: number;
  /** Somado quando o jogador é a Bola Murcha (por isso negativo). */
  bolaMurcha: number;
  /** Goleiro que não sofreu gol. */
  cleanSheet: number;
  /** Por gol sofrido pelo goleiro (negativo). */
  goalConceded: number;
  captainMultiplier: number;
}

export const DEFAULT_CARTOLA_SCORING: Readonly<CartolaScoringConfig> = {
  goal: 3,
  assist: 2,
  win: 1,
  draw: 0,
  mvp: 3,
  bolaMurcha: -2,
  cleanSheet: 2,
  goalConceded: -0.5,
  captainMultiplier: 1.5,
};

/** Parâmetros da valorização. Calibrados com os dados das primeiras rodadas. */
export interface CartolaPriceConfig {
  /** Pontos esperados por cartoleta de preço: esperado = preço × k. */
  k: number;
  /** Cartoletas ganhas/perdidas por ponto acima/abaixo do esperado. */
  factor: number;
  /** Variação máxima por rodada, como fração do preço (0,1 = ±10%). */
  maxChangeRatio: number;
  minPrice: number;
}

export const DEFAULT_CARTOLA_PRICE: Readonly<CartolaPriceConfig> = {
  k: 0.5,
  factor: 0.3,
  maxChangeRatio: 0.1,
  minPrice: 3,
};

/** Cartoletas com que todo participante começa a temporada. */
export const CARTOLA_INITIAL_BUDGET = 100;

/** Arredonda pontos e preços para 2 casas, evitando ruído de ponto flutuante. */
export function roundTo2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
