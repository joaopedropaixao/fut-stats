import {
  FORMATION,
  MAX_RESERVES_PER_TEAM,
  PLAYERS_PER_TEAM,
  POSITIONS,
  type LineupSlot,
  type Player,
  type Position,
  type RoundLineup,
  type Team,
} from '../core';
import { solveAssignment } from './assignment';
import type { RandomFn } from './random';

export interface BalanceTeamsConfig {
  /** λ: quanto cada dupla repetida "custa", em pontos de força. */
  repeatedPairWeight: number;
  /** Quantas rodadas do histórico (as mais recentes) olhar para achar duplas repetidas. */
  lookbackRounds: number;
  /** Multiplicador da nota de quem joga na posição secundária. */
  offPositionFactor: number;
  /** Máximo de reservas em cada time. */
  maxReservesPerTeam: number;
  /** Fonte de aleatoriedade para desempatar; injete `seededRandom(n)` para ter determinismo. */
  random: RandomFn;
}

export const DEFAULT_BALANCE_TEAMS_CONFIG: Readonly<BalanceTeamsConfig> = {
  repeatedPairWeight: 0.5,
  lookbackRounds: 3,
  offPositionFactor: 0.9,
  maxReservesPerTeam: MAX_RESERVES_PER_TEAM,
  random: Math.random,
};

/** Reservas de cada time (entram no revezamento, sem posição fixa). */
export type TeamReserves = Readonly<Record<Team, readonly string[]>>;

/** Rodada já jogada; `reserves` é opcional porque escalações antigas podem não ter. */
export type PastRound = RoundLineup & { readonly reserves?: TeamReserves };

/** Times gerados: Branco x Preto 1-2-3-1 mais os reservas de cada lado. */
export interface BalancedRound extends RoundLineup {
  readonly reserves: TeamReserves;
}

export type BalanceTeamsError =
  | 'DUPLICATE_PLAYER'
  | 'NOT_ENOUGH_PLAYERS'
  | 'TOO_MANY_PLAYERS'
  | 'NOT_ENOUGH_GOALKEEPERS'
  | 'TOO_MANY_GOALKEEPERS'
  | 'POSITIONS_UNFILLABLE';

export type BalanceTeamsResult =
  | {
      ok: true;
      round: BalancedRound;
      /** Força de cada time: soma das notas normalizada para 7 jogadores. */
      strength: Record<Team, number>;
      /** Duplas do mesmo time que já jogaram juntas nas últimas rodadas (sem goleiros). */
      repeatedPairs: number;
    }
  | { ok: false; error: BalanceTeamsError };

const LINE_POSITIONS = POSITIONS.filter((p) => p !== 'GOALKEEPER');
const LINE_STARTERS = PLAYERS_PER_TEAM - FORMATION.GOALKEEPER;
const UNFILLABLE = 1e6;
const EPSILON = 1e-9;

/**
 * Gera Branco x Preto equilibrados na formação 1-2-3-1, minimizando
 * `|diferença de força| + λ · duplas repetidas`.
 *
 * Aceita de 14 a 14 + 2 · maxReservesPerTeam confirmados, com exatamente 2 goleiros
 * (posição principal). Quem sobra vira reserva de um dos times (diferença máxima de 1).
 * Jogadores de linha só jogam na posição principal ou nas secundárias, preferindo a principal.
 *
 * @param history rodadas anteriores, da mais antiga para a mais recente.
 */
export function balanceTeams(
  players: readonly Player[],
  history: readonly PastRound[] = [],
  config: Partial<BalanceTeamsConfig> = {},
): BalanceTeamsResult {
  const cfg = { ...DEFAULT_BALANCE_TEAMS_CONFIG, ...config };

  if (new Set(players.map((p) => p.id)).size !== players.length) {
    return { ok: false, error: 'DUPLICATE_PLAYER' };
  }
  if (players.length < 2 * PLAYERS_PER_TEAM) return { ok: false, error: 'NOT_ENOUGH_PLAYERS' };
  if (players.length > 2 * (PLAYERS_PER_TEAM + cfg.maxReservesPerTeam)) {
    return { ok: false, error: 'TOO_MANY_PLAYERS' };
  }

  const goalkeepers = players.filter((p) => p.primaryPosition === 'GOALKEEPER');
  const [gkA, gkB] = goalkeepers;
  if (!gkA || !gkB) return { ok: false, error: 'NOT_ENOUGH_GOALKEEPERS' };
  if (goalkeepers.length > 2) return { ok: false, error: 'TOO_MANY_GOALKEEPERS' };

  const line = players.filter((p) => p.primaryPosition !== 'GOALKEEPER');

  // Menor número possível de jogadores fora da posição principal, olhando os dois times juntos.
  const overall = assignPositions(line, 2, cfg.offPositionFactor);
  if (!overall) return { ok: false, error: 'POSITIONS_UNFILLABLE' };

  const together = countTogether(line, history.slice(-cfg.lookbackRounds));
  const reserves = line.length - 2 * LINE_STARTERS;

  // Testa toda divisão possível dos jogadores de linha (no pior caso, 18 confirmados, C(16,8) = 12.870)
  // e guarda as de menor custo para sortear entre elas.
  let best: Candidate[] = [];
  let bestCost = Infinity;

  for (const whiteSize of whiteLineSizes(reserves, cfg.maxReservesPerTeam)) {
    for (const whiteIdx of combinations(line.length, whiteSize)) {
      const inWhite = new Set(whiteIdx);
      const blackIdx = line.map((_, i) => i).filter((i) => !inWhite.has(i));

      const white = assignPositions(pick(line, whiteIdx), 1, cfg.offPositionFactor);
      const black = assignPositions(pick(line, blackIdx), 1, cfg.offPositionFactor);
      if (!white || !black) continue;
      if (white.offPosition + black.offPosition > overall.offPosition) continue;

      const repeatedPairs = sumTogether(together, whiteIdx) + sumTogether(together, blackIdx);

      for (const [whiteGk, blackGk] of [
        [gkA, gkB],
        [gkB, gkA],
      ] as const) {
        const strength = {
          WHITE: normalize(white.strength + whiteGk.rating, whiteIdx.length + 1),
          BLACK: normalize(black.strength + blackGk.rating, blackIdx.length + 1),
        };
        const cost =
          Math.abs(strength.WHITE - strength.BLACK) + cfg.repeatedPairWeight * repeatedPairs;

        if (cost < bestCost - EPSILON) {
          bestCost = cost;
          best = [];
        }
        if (cost <= bestCost + EPSILON) {
          best.push({ white, black, whiteGk, blackGk, strength, repeatedPairs });
        }
      }
    }
  }

  const chosen = best[Math.floor(cfg.random() * best.length)];
  if (!chosen) return { ok: false, error: 'POSITIONS_UNFILLABLE' };

  return {
    ok: true,
    round: {
      WHITE: [{ playerId: chosen.whiteGk.id, position: 'GOALKEEPER' }, ...chosen.white.slots],
      BLACK: [{ playerId: chosen.blackGk.id, position: 'GOALKEEPER' }, ...chosen.black.slots],
      reserves: { WHITE: chosen.white.reserves, BLACK: chosen.black.reserves },
    },
    strength: { WHITE: round2(chosen.strength.WHITE), BLACK: round2(chosen.strength.BLACK) },
    repeatedPairs: chosen.repeatedPairs,
  };
}

interface TeamAssignment {
  slots: LineupSlot[];
  reserves: string[];
  /** Quantos jogam na posição secundária. */
  offPosition: number;
  /** Soma das notas (com desconto para quem joga fora da posição principal). */
  strength: number;
}

interface Candidate {
  white: TeamAssignment;
  black: TeamAssignment;
  whiteGk: Player;
  blackGk: Player;
  strength: Record<Team, number>;
  repeatedPairs: number;
}

/**
 * Distribui jogadores de linha nas vagas da formação (`teams` = quantos times de vagas)
 * e o resto como reservas, minimizando quem joga fora da posição principal.
 * Devolve `null` se nem com as posições secundárias dá para fechar a formação.
 */
function assignPositions(
  players: readonly Player[],
  teams: number,
  offPositionFactor: number,
): TeamAssignment | null {
  const positions: (Position | null)[] = LINE_POSITIONS.flatMap((p) =>
    Array.from({ length: FORMATION[p] * teams }, () => p),
  );
  if (positions.length > players.length) return null;
  // `null` = vaga de reserva: qualquer um serve, sem custo.
  while (positions.length < players.length) positions.push(null);

  const cost = players.map((player) => positions.map((position) => slotCost(player, position)));
  const columnOf = solveAssignment(cost);

  const playerAt = new Map(columnOf.map((col, row) => [col, players[row]!]));
  const result: TeamAssignment = { slots: [], reserves: [], offPosition: 0, strength: 0 };

  positions.forEach((position, col) => {
    const player = playerAt.get(col)!;
    const c = slotCost(player, position);
    if (c >= UNFILLABLE) result.offPosition = UNFILLABLE;
    if (position === null) {
      result.reserves.push(player.id);
      result.strength += player.rating;
      return;
    }
    result.slots.push({ playerId: player.id, position });
    result.offPosition += c;
    result.strength += c === 0 ? player.rating : player.rating * offPositionFactor;
  });

  return result.offPosition >= UNFILLABLE ? null : result;
}

/** 0 na posição principal (ou reserva), 1 na secundária, proibitivo fora delas. */
function slotCost(player: Player, position: Position | null): number {
  if (position === null || position === player.primaryPosition) return 0;
  return player.secondaryPositions.includes(position) ? 1 : UNFILLABLE;
}

/** Tamanhos possíveis da linha do Branco, dividindo os reservas com diferença máxima de 1. */
function whiteLineSizes(reserves: number, maxPerTeam: number): number[] {
  const sizes = new Set([Math.floor(reserves / 2), Math.ceil(reserves / 2)]);
  return [...sizes].filter((r) => r <= maxPerTeam).map((r) => LINE_STARTERS + r);
}

/** `together[i][j]`: em quantas rodadas os jogadores de linha i e j estiveram no mesmo time. */
function countTogether(line: readonly Player[], rounds: readonly PastRound[]): number[][] {
  const index = new Map(line.map((p, i) => [p.id, i]));
  const together = line.map(() => new Array<number>(line.length).fill(0));

  for (const round of rounds) {
    for (const team of ['WHITE', 'BLACK'] as const) {
      const ids = [...round[team].map((s) => s.playerId), ...(round.reserves?.[team] ?? [])];
      const members = ids.map((id) => index.get(id)).filter((i) => i !== undefined);
      for (const i of members) {
        for (const j of members) if (i !== j) together[i]![j]! += 1;
      }
    }
  }
  return together;
}

function sumTogether(together: readonly (readonly number[])[], team: readonly number[]): number {
  let sum = 0;
  for (let a = 0; a < team.length; a += 1) {
    for (let b = a + 1; b < team.length; b += 1) sum += together[team[a]!]![team[b]!]!;
  }
  return sum;
}

/** Todas as combinações de `k` índices entre 0 e n - 1, em ordem crescente. */
function* combinations(n: number, k: number, start = 0): Generator<number[]> {
  if (k === 0) {
    yield [];
    return;
  }
  for (let i = start; i <= n - k; i += 1) {
    for (const rest of combinations(n, k - 1, i + 1)) yield [i, ...rest];
  }
}

function pick<T>(items: readonly T[], indexes: readonly number[]): T[] {
  return indexes.map((i) => items[i]!);
}

/** Leva a soma das notas para a escala de um time de 7, para comparar times de tamanhos diferentes. */
function normalize(sum: number, size: number): number {
  return (sum * PLAYERS_PER_TEAM) / size;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
