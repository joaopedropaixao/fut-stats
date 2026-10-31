// Simulação do seletor de times: roda o `balanceTeams` real em grupos simulados (elenco do seed) com
// variações de config e imprime uma tabela para recalibrar os pesos. Uso:
//   pnpm --filter @fut-stats/api simular:seletor [grupos] [rodadas]
// Os jogos são sorteados: a força real de cada um é a nota + ruído, e algumas duplas rendem mais juntas
// (panelinhas escondidas). Serve para comparar configs, não para prever resultado.
import {
  balanceTeams,
  seededRandom,
  type BalanceTeamsConfig,
  type PastRound,
  type Player,
  type RandomFn,
} from '@fut-stats/domain';
import { MEMBERS } from '../src/seed/seed-data';

interface SimConfig {
  name: string;
  config: Partial<BalanceTeamsConfig>;
}

const ROSTER: Player[] = MEMBERS.map((m) => ({
  id: m.nickname,
  primaryPosition: m.primaryPosition,
  secondaryPositions: [...m.secondaryPositions],
  rating: m.initialRating,
}));

/** Duplas que rendem mais juntas do que as notas dizem. */
const CLIQUES: [string, string][] = [
  ['Jota', 'Marcelinho'],
  ['Felipinho', 'Jota'],
  ['Carlão', 'Rafa'],
  ['Diegão', 'Rique'],
];
const CLIQUE_BONUS = 0.35;

const CONFIGS: SimConfig[] = [
  { name: 'Só equilíbrio (τ 0)', config: { repeatedPairWeight: 0, cliqueWeight: 0, tolerance: 0 } },
  { name: 'Só equilíbrio + τ 0,10', config: { repeatedPairWeight: 0, cliqueWeight: 0 } },
  { name: 'Repetição λ 0,02 (sem panelinha)', config: { cliqueWeight: 0 } },
  { name: 'Padrão (λ 0,02, μ 0,05, τ 0,10)', config: {} },
  { name: 'Panelinha μ 0,10', config: { cliqueWeight: 0.1 } },
  { name: 'Panelinha μ 0,20', config: { cliqueWeight: 0.2 } },
  { name: 'Panelinha μ 0,10, τ 0,05', config: { cliqueWeight: 0.1, tolerance: 0.05 } },
  {
    name: 'Panelinha μ 0,10, margem ignorada (cap 1)',
    config: { cliqueWeight: 0.1, cliqueMarginCap: 1 },
  },
];

interface Metrics {
  gap: number;
  goalGap: number;
  close: number;
  repeated: number;
  clique: number;
  distinct: number;
}

function poisson(lambda: number, random: RandomFn): number {
  const limit = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k += 1;
    p *= random();
  } while (p > limit);
  return k - 1;
}

function gauss(random: RandomFn): number {
  return Math.sqrt(-2 * Math.log(random() || 1e-9)) * Math.cos(2 * Math.PI * random());
}

function shuffled<T>(items: readonly T[], random: RandomFn): T[] {
  return items
    .map((item) => ({ item, key: random() }))
    .sort((a, b) => a.key - b.key)
    .map((x) => x.item);
}

type Round = Extract<ReturnType<typeof balanceTeams>, { ok: true }>['round'];

const idsOf = (round: Round, team: 'WHITE' | 'BLACK') => [
  ...round[team].map((s) => s.playerId),
  ...round.reserves[team],
];

/** Divisão sem lado nem posição, para contar divisões distintas. */
const keyOf = (round: Round) =>
  [idsOf(round, 'WHITE').sort().join(), idsOf(round, 'BLACK').sort().join()].sort().join('|');

function simulate(sim: SimConfig, seed: number, rounds: number): Metrics {
  const random = seededRandom(seed);
  const truth = new Map(ROSTER.map((p) => [p.id, p.rating + 0.75 * gauss(random)]));
  const history: PastRound[] = [];
  const total: Metrics = { gap: 0, goalGap: 0, close: 0, repeated: 0, clique: 0, distinct: 0 };
  const lastRounds = 5;
  let previous: Round | null = null;

  for (let r = 0; r < rounds; r += 1) {
    const goalkeepers = shuffled(
      ROSTER.filter((p) => p.primaryPosition === 'GOALKEEPER'),
      random,
    ).slice(0, 2);
    const lineCount = [12, 13, 14, 14, 14, 15, 16][Math.floor(random() * 7)]!;
    const line = shuffled(
      ROSTER.filter((p) => p.primaryPosition !== 'GOALKEEPER'),
      random,
    ).slice(0, lineCount);
    const players = [...goalkeepers, ...line];
    const generate = (avoid?: Round) => {
      const result = balanceTeams(players, history, { ...sim.config, random }, { avoid });
      return result.ok ? result : null;
    };

    const first = generate();
    if (!first) {
      r -= 1; // elenco que não fecha o 1-2-3-1: sorteia outro
      continue;
    }

    // Variedade do Regerar: cinco toques seguidos nas últimas rodadas.
    if (r >= rounds - lastRounds) {
      const keys = new Set([keyOf(first.round)]);
      let current = first.round;
      for (let k = 0; k < 4; k += 1) {
        const next = generate(current);
        if (!next) break;
        keys.add(keyOf(next.round));
        current = next.round;
      }
      total.distinct += keys.size / lastRounds;
    }

    const white = idsOf(first.round, 'WHITE');
    const black = idsOf(first.round, 'BLACK');
    const strength = (ids: string[]) => {
      let value = ids.reduce((sum, id) => sum + truth.get(id)!, 0) / ids.length;
      for (const [a, b] of CLIQUES) if (ids.includes(a) && ids.includes(b)) value += CLIQUE_BONUS;
      return value;
    };
    const edge = strength(white) - strength(black);
    const goalsWhite = poisson(4 * Math.exp(0.35 * edge), random);
    const goalsBlack = poisson(4 * Math.exp(-0.35 * edge), random);
    const margin = Math.abs(goalsWhite - goalsBlack);

    if (previous) {
      for (const team of ['WHITE', 'BLACK'] as const) {
        for (const before of ['WHITE', 'BLACK'] as const) {
          const together = idsOf(first.round, team).filter(
            (id) => idsOf(previous!, before).includes(id) && !goalkeepers.some((g) => g.id === id),
          ).length;
          total.repeated += (together * (together - 1)) / 2;
        }
      }
    }
    total.clique += CLIQUES.filter(([a, b]) =>
      [white, black].some((t) => t.includes(a) && t.includes(b)),
    ).length;
    total.gap += Math.abs(first.strength.WHITE - first.strength.BLACK) / 7;
    total.goalGap += margin;
    total.close += margin <= 1 ? 1 : 0;

    history.push({
      ...first.round,
      score: { WHITE: goalsWhite, BLACK: goalsBlack },
    });
    previous = first.round;
  }

  return {
    gap: total.gap / rounds,
    goalGap: total.goalGap / rounds,
    close: total.close / rounds,
    repeated: total.repeated / (rounds - 1),
    clique: total.clique / rounds,
    distinct: total.distinct,
  };
}

const groups = Number(process.argv[2] ?? 3);
const rounds = Number(process.argv[3] ?? 20);
const fmt = (value: number, digits = 2) => value.toFixed(digits).replace('.', ',');

console.log(
  `Simulação do seletor: ${groups} grupos de ${rounds} rodadas, elenco do seed (${ROSTER.length} jogadores).\n`,
);
console.log(
  '| Config | dif. média das notas | dif. de gols | jogos ≤ 1 gol | duplas repetidas da anterior | panelinhas juntas por rodada (de 4) | Regerar: divisões distintas em 5 |',
);
console.log('|---|---|---|---|---|---|---|');
for (const sim of CONFIGS) {
  const sum: Metrics = { gap: 0, goalGap: 0, close: 0, repeated: 0, clique: 0, distinct: 0 };
  for (let g = 0; g < groups; g += 1) {
    const m = simulate(sim, 1000 + g, rounds);
    for (const key of Object.keys(sum) as (keyof Metrics)[]) sum[key] += m[key] / groups;
  }
  console.log(
    `| ${sim.name} | ${fmt(sum.gap, 3)} | ${fmt(sum.goalGap)} | ${fmt(sum.close * 100, 0)}% | ${fmt(sum.repeated, 1)} | ${fmt(sum.clique)} | ${fmt(sum.distinct, 1)} |`,
  );
}
