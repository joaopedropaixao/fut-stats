import type { Player, Team } from '../core';
import type { RoundTeams } from '../round/match';

export interface TeamBalanceConfig {
  /** Multiplicador da nota de quem joga fora da posição principal (secundária ou não). */
  offPositionFactor: number;
  /** Diferença de média até a qual os times contam como equilibrados. */
  balancedThreshold: number;
}

export const DEFAULT_TEAM_BALANCE_CONFIG: Readonly<TeamBalanceConfig> = {
  offPositionFactor: 0.9,
  balancedThreshold: 0.5,
};

/** Equilíbrio de Branco x Preto pela média das notas. `null` = algum time vazio, sem comparação. */
export interface TeamBalance {
  /** Média de cada time (2 casas); `null` se o time está vazio. */
  average: Record<Team, number | null>;
  /** |média Branco − média Preto| (2 casas). */
  difference: number | null;
  /** Diferença ≤ `balancedThreshold`. */
  balanced: boolean | null;
  /** O time mais forte quando não está equilibrado; `null` se equilibrado ou sem comparação. */
  stronger: Team | null;
}

export type BalancePlayer = Pick<Player, 'id' | 'primaryPosition' | 'rating'>;

/**
 * Média de cada time e se a diferença está boa. Titular fora da principal vale nota × `offPositionFactor`;
 * reserva vale a nota cheia. Jogador que não está em `players` é ignorado.
 *
 * Contrato da fatia `seletor-de-times`: a implementação (com testes) é do dev-back.
 */
export function teamBalance(
  _teams: RoundTeams,
  _players: readonly BalancePlayer[],
  _config: Partial<TeamBalanceConfig> = {},
): TeamBalance {
  return {
    average: { WHITE: null, BLACK: null },
    difference: null,
    balanced: null,
    stronger: null,
  };
}
