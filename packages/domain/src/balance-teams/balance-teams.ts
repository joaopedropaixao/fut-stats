import {
  FORMATION,
  MAX_RESERVES_PER_TEAM,
  PLAYERS_PER_TEAM,
  POSITIONS,
  type LineupSlot,
  type Player,
  type Position,
  type RoundLineup,
  TEAMS,
  type Team,
} from '../core';
import { solveAssignment } from './assignment';
import type { MatchScore } from '../round/match';
import type { RandomFn } from './random';

export interface BalanceTeamsConfig {
  /** λ: quanto cada unidade de repetição em excesso "custa", em média de nota. */
  repeatedPairWeight: number;
  /**
   * Peso de cada rodada para as duplas repetidas, da mais recente para a mais antiga. O tamanho da lista é a
   * janela: só essas rodadas do histórico são olhadas.
   */
  recencyWeights: readonly number[];
  /** μ: quanto o saldo de vitórias juntos (panelinha) "custa", em média de nota. */
  cliqueWeight: number;
  /** Peso de cada rodada com placar para a panelinha, da mais recente para a mais antiga (a lista é a janela). */
  cliqueRecencyWeights: readonly number[];
  /** Diferença de gols a partir da qual a vitória pesa o máximo na panelinha (abaixo, pesa margem / cap). */
  cliqueMarginCap: number;
  /** τ: folga, em média de nota, sobre o melhor custo. O sorteio é entre as divisões dentro dela. */
  tolerance: number;
  /** Multiplicador da nota de quem joga na posição secundária. */
  offPositionFactor: number;
  /** Máximo de reservas em cada time. */
  maxReservesPerTeam: number;
  /** Fonte de aleatoriedade para desempatar; injete `seededRandom(n)` para ter determinismo. */
  random: RandomFn;
}

export const DEFAULT_BALANCE_TEAMS_CONFIG: Readonly<BalanceTeamsConfig> = {
  repeatedPairWeight: 0.02,
  recencyWeights: [1, 0.75, 0.5, 0.25],
  cliqueWeight: 0.05,
  cliqueRecencyWeights: Array.from(
    { length: 10 },
    (_, k) => Math.round((1 - 0.09 * k) * 100) / 100,
  ),
  cliqueMarginCap: 4,
  tolerance: 0.1,
  offPositionFactor: 0.9,
  maxReservesPerTeam: MAX_RESERVES_PER_TEAM,
  random: Math.random,
};

/** Reservas de cada time (entram no revezamento, sem posição fixa). */
export type TeamReserves = Readonly<Record<Team, readonly string[]>>;

/**
 * Rodada já jogada; `reserves` é opcional porque escalações antigas podem não ter. Sem `score` (ou nulo), a
 * rodada não conta na panelinha.
 */
export type PastRound = RoundLineup & {
  readonly reserves?: TeamReserves;
  readonly score?: MatchScore | null;
};

/** Opções de uma geração. */
export interface BalanceTeamsOptions {
  /**
   * Divisão a evitar (o Regerar passa a de agora). Compara só quem está com quem, ignorando lado e posição.
   * Só é evitada se houver outra dentro da tolerância.
   */
  avoid?: PastRound;
}

/** Times gerados: Branco x Preto 1-2-3-1 mais os reservas de cada lado. */
export interface BalancedRound extends RoundLineup {
  readonly reserves: TeamReserves;
}

/** Por que não deu para gerar os times. O texto de cada um fica no shared (`BALANCE_TEAMS_ERROR_LABELS`). */
export const BALANCE_TEAMS_ERRORS = [
  'DUPLICATE_PLAYER',
  'NOT_ENOUGH_PLAYERS',
  'TOO_MANY_PLAYERS',
  'NOT_ENOUGH_GOALKEEPERS',
  'TOO_MANY_GOALKEEPERS',
  'POSITIONS_UNFILLABLE',
] as const;

export type BalanceTeamsError = (typeof BALANCE_TEAMS_ERRORS)[number];

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
 * Gera Branco x Preto na formação 1-2-3-1 minimizando
 * `|média Branco − média Preto| + λ · repetição em excesso + μ · panelinha` (tudo em média de nota). Depois
 * sorteia entre as divisões até `tolerance` do melhor custo, evitando `options.avoid` se houver outra.
 *
 * - Repetição em excesso: por dupla de linha, `max(0, Σ peso · juntos − Σ peso · chance de cair junto)` nas
 *   últimas `recencyWeights.length` rodadas, com mais peso para a mais recente.
 * - Panelinha: por dupla de linha, o saldo `Σ peso · ±min(diferença de gols, cap) / cap` (+ se venceram no mesmo
 *   time, − se perderam), nas últimas `cliqueRecencyWeights.length` rodadas com placar; entra como `max(0, saldo)`.
 * - Goleiro não entra em dupla nem em panelinha. A posição vem antes: nenhuma divisão põe mais gente fora da
 *   principal que o mínimo possível.
 *
 * Aceita de 14 a 14 + 2 · maxReservesPerTeam confirmados, com exatamente 2 goleiros (posição principal).
 * Quem sobra vira reserva de um dos times (diferença máxima de 1). Jogadores de linha só jogam na posição
 * principal ou nas secundárias, preferindo a principal.
 *
 * @param history rodadas anteriores, da mais antiga para a mais recente.
 */
export function balanceTeams(
  players: readonly Player[],
  history: readonly PastRound[] = [],
  config: Partial<BalanceTeamsConfig> = {},
  options: BalanceTeamsOptions = {},
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

  const pairs = pairStats(line, history, cfg);
  const reserves = line.length - 2 * LINE_STARTERS;

  // Testa toda divisão possível dos jogadores de linha (no pior caso, 18 confirmados, C(16,8) = 12.870).
  const candidates: Candidate[] = [];
  let bestCost = Infinity;

  for (const whiteSize of whiteLineSizes(reserves, cfg.maxReservesPerTeam)) {
    for (const whiteIdx of combinations(line.length, whiteSize)) {
      const inWhite = new Set(whiteIdx);
      const blackIdx = line.map((_, i) => i).filter((i) => !inWhite.has(i));

      const white = assignPositions(pick(line, whiteIdx), 1, cfg.offPositionFactor);
      const black = assignPositions(pick(line, blackIdx), 1, cfg.offPositionFactor);
      if (!white || !black) continue;
      if (white.offPosition + black.offPosition > overall.offPosition) continue;

      const pairCost = sumPairs(pairs.penalty, whiteIdx) + sumPairs(pairs.penalty, blackIdx);
      const repeatedPairs = sumPairs(pairs.together, whiteIdx) + sumPairs(pairs.together, blackIdx);

      for (const [whiteGk, blackGk] of [
        [gkA, gkB],
        [gkB, gkA],
      ] as const) {
        const averageGap = Math.abs(
          (white.strength + whiteGk.rating) / (whiteIdx.length + 1) -
            (black.strength + blackGk.rating) / (blackIdx.length + 1),
        );
        const cost = averageGap + pairCost;
        if (cost < bestCost) bestCost = cost;
        candidates.push({
          cost,
          white,
          black,
          whiteGk,
          blackGk,
          whiteIdx,
          blackIdx,
          repeatedPairs,
        });
      }
    }
  }

  let pool = candidates.filter((c) => c.cost <= bestCost + cfg.tolerance + EPSILON);
  if (options.avoid) {
    const avoidKey = divisionKey(
      lineupIds(options.avoid, 'WHITE'),
      lineupIds(options.avoid, 'BLACK'),
    );
    const others = pool.filter((c) => candidateKey(c, line) !== avoidKey);
    if (others.length > 0) pool = others;
  }

  const chosen = pool[Math.floor(cfg.random() * pool.length)];
  if (!chosen) return { ok: false, error: 'POSITIONS_UNFILLABLE' };

  const strength = {
    WHITE: normalize(chosen.white.strength + chosen.whiteGk.rating, chosen.whiteIdx.length + 1),
    BLACK: normalize(chosen.black.strength + chosen.blackGk.rating, chosen.blackIdx.length + 1),
  };

  return {
    ok: true,
    round: {
      WHITE: [{ playerId: chosen.whiteGk.id, position: 'GOALKEEPER' }, ...chosen.white.slots],
      BLACK: [{ playerId: chosen.blackGk.id, position: 'GOALKEEPER' }, ...chosen.black.slots],
      reserves: { WHITE: chosen.white.reserves, BLACK: chosen.black.reserves },
    },
    strength: { WHITE: round2(strength.WHITE), BLACK: round2(strength.BLACK) },
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
  /** |diferença de média| + custo das duplas (repetição e panelinha). */
  cost: number;
  white: TeamAssignment;
  black: TeamAssignment;
  whiteGk: Player;
  blackGk: Player;
  /** Índices (em `line`) dos jogadores de linha de cada time, titulares e reservas. */
  whiteIdx: number[];
  blackIdx: number[];
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

interface PairStats {
  /** Contagem crua de rodadas da janela em que a dupla jogou no mesmo time. */
  together: number[][];
  /** Custo da dupla se cair junta: λ · repetição em excesso + μ · max(0, saldo da panelinha). */
  penalty: number[][];
}

/** Jogadores de linha de cada time numa rodada passada (titulares fora do gol e reservas). */
function lineOfTeam(round: PastRound, team: Team): string[] {
  return [
    ...round[team].filter((s) => s.position !== 'GOALKEEPER').map((s) => s.playerId),
    ...(round.reserves?.[team] ?? []),
  ];
}

/** Todos os ids de um time numa escalação (goleiro, titulares e reservas). */
function lineupIds(round: PastRound, team: Team): string[] {
  return [...round[team].map((s) => s.playerId), ...(round.reserves?.[team] ?? [])];
}

const square = (n: number): number[][] =>
  Array.from({ length: n }, () => new Array<number>(n).fill(0));

/** Para cada dupla de linha dos confirmados: quantas vezes jogou junta, o excesso sobre o acaso e o saldo. */
function pairStats(
  line: readonly Player[],
  history: readonly PastRound[],
  cfg: BalanceTeamsConfig,
): PairStats {
  const index = new Map(line.map((p, i) => [p.id, i]));
  const n = line.length;
  const together = square(n);
  const weighted = square(n);
  const expected = square(n);
  const balance = square(n);

  const members = (ids: readonly string[]) =>
    ids.map((id) => index.get(id)).filter((i): i is number => i !== undefined);

  // Do mais recente para o mais antigo: o peso k vale para a k-ésima rodada de trás para frente.
  const newestFirst = [...history].reverse();

  newestFirst.slice(0, cfg.recencyWeights.length).forEach((round, k) => {
    const weight = cfg.recencyWeights[k]!;
    const white = lineOfTeam(round, 'WHITE');
    const black = lineOfTeam(round, 'BLACK');
    const total = white.length + black.length;
    // Chance de duas pessoas que jogaram a rodada caírem no mesmo time, ao acaso.
    const chance = total > 1 ? (total / 2 - 1) / (total - 1) : 0;

    const played = members([...white, ...black]);
    for (const i of played)
      for (const j of played) if (i !== j) expected[i]![j]! += weight * chance;
    for (const team of [white, black]) {
      const mates = members(team);
      for (const i of mates) {
        for (const j of mates) {
          if (i === j) continue;
          together[i]![j]! += 1;
          weighted[i]![j]! += weight;
        }
      }
    }
  });

  newestFirst.slice(0, cfg.cliqueRecencyWeights.length).forEach((round, k) => {
    const score = round.score;
    if (!score || score.WHITE === score.BLACK) return;
    const weight = cfg.cliqueRecencyWeights[k]!;
    const margin =
      Math.min(Math.abs(score.WHITE - score.BLACK), cfg.cliqueMarginCap) / cfg.cliqueMarginCap;
    const winner: Team = score.WHITE > score.BLACK ? 'WHITE' : 'BLACK';
    for (const team of TEAMS) {
      const mates = members(lineOfTeam(round, team));
      const sign = team === winner ? 1 : -1;
      for (const i of mates) {
        for (const j of mates) if (i !== j) balance[i]![j]! += weight * sign * margin;
      }
    }
  });

  const penalty = square(n);
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      const excess = Math.max(0, weighted[i]![j]! - expected[i]![j]!);
      penalty[i]![j] =
        cfg.repeatedPairWeight * excess + cfg.cliqueWeight * Math.max(0, balance[i]![j]!);
    }
  }
  return { together, penalty };
}

/** Soma `matrix[a][b]` das duplas (a < b) do time. */
function sumPairs(matrix: readonly (readonly number[])[], team: readonly number[]): number {
  let sum = 0;
  for (let a = 0; a < team.length; a += 1) {
    for (let b = a + 1; b < team.length; b += 1) sum += matrix[team[a]!]![team[b]!]!;
  }
  return sum;
}

/** Chave de uma divisão: quem está com quem, sem lado nem posição. */
function divisionKey(white: readonly string[], black: readonly string[]): string {
  const side = (ids: readonly string[]) => [...ids].sort().join(',');
  return [side(white), side(black)].sort().join('|');
}

function candidateKey(candidate: Candidate, line: readonly Player[]): string {
  const ids = (gk: Player, idx: readonly number[]) => [gk.id, ...idx.map((i) => line[i]!.id)];
  return divisionKey(
    ids(candidate.whiteGk, candidate.whiteIdx),
    ids(candidate.blackGk, candidate.blackIdx),
  );
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
