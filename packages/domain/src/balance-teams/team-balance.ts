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
  /** |média Branco − média Preto| (1 casa, como a tela mostra). */
  difference: number | null;
  /** Diferença ≤ `balancedThreshold`. */
  balanced: boolean | null;
  /** O time mais forte quando não está equilibrado; `null` se equilibrado ou sem comparação. */
  stronger: Team | null;
}

export type BalancePlayer = Pick<Player, 'id' | 'primaryPosition' | 'rating'>;

/**
 * Média de cada time e se a diferença está boa. Titular fora da principal vale nota × `offPositionFactor`
 * (esteja ou não nas secundárias); reserva vale a nota cheia. Jogador que não está em `players` é ignorado.
 */
export function teamBalance(
  teams: RoundTeams,
  players: readonly BalancePlayer[],
  config: Partial<TeamBalanceConfig> = {},
): TeamBalance {
  const cfg = { ...DEFAULT_TEAM_BALANCE_CONFIG, ...config };
  const byId = new Map(players.map((p) => [p.id, p]));

  const average = (team: Team): number | null => {
    const values: number[] = [];
    for (const slot of teams[team]) {
      const player = byId.get(slot.playerId);
      if (!player) continue;
      values.push(
        slot.position === player.primaryPosition
          ? player.rating
          : player.rating * cfg.offPositionFactor,
      );
    }
    for (const id of teams.reserves[team]) {
      const player = byId.get(id);
      if (player) values.push(player.rating);
    }
    if (values.length === 0) return null;
    return round2(values.reduce((sum, v) => sum + v, 0) / values.length);
  };

  const white = average('WHITE');
  const black = average('BLACK');
  if (white === null || black === null) {
    return {
      average: { WHITE: white, BLACK: black },
      difference: null,
      balanced: null,
      stronger: null,
    };
  }

  // 1 casa, o número que a tela mostra: assim "equilibrado" nunca contradiz o texto.
  const difference = Math.round(Math.abs(white - black) * 10) / 10;
  const balanced = difference <= cfg.balancedThreshold;
  return {
    average: { WHITE: white, BLACK: black },
    difference,
    balanced,
    stronger: balanced ? null : white > black ? 'WHITE' : 'BLACK',
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
