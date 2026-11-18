import type { ResultPlayer } from '@fut-stats/shared';

/** Texto de apresentação da carta: a frase de impacto do Craque e a piada do Perna de Pau. Não é regra de negócio. */
type Stats = Pick<ResultPlayer, 'goals' | 'assists' | 'position'>;

const WON_SUFFIX = 'e ainda levou a vitória';

/**
 * A frase de impacto do Craque pelos números dele na partida. A primeira regra que bater vence:
 * 3+ gols, gol e assistência, 2 gols, 2+ assistências, goleiro, 1 assistência ("Deu o passe"), 1 gol, senão
 * "Jogou demais".
 * Time vencedor (`won`) soma "e ainda levou a vitória". Gol contra não entra (a API já não conta).
 */
export function impactPhrase(player: Stats, { won }: { won: boolean }): string {
  const { goals, assists } = player;
  const base =
    goals >= 3
      ? 'Hat-trick!'
      : goals >= 1 && assists >= 1
        ? 'Dono do jogo'
        : goals === 2
          ? 'Decidiu a partida'
          : assists >= 2
            ? 'Garçom da noite'
            : player.position === 'GOALKEEPER'
              ? 'Paredão no gol'
              : assists === 1
                ? 'Deu o passe'
                : goals === 1
                  ? 'Balançou a rede'
                  : 'Jogou demais';
  return won ? `${base.replace(/!$/, '')} ${WON_SUFFIX}` : base;
}

/** As frases do Perna de Pau: tom de zoeira, nunca de humilhação. */
export const FLOP_PHRASES = ['Hoje não deu', 'O pé tava torto', 'Na próxima vai'] as const;

/**
 * A frase do Perna de Pau, escolhida de forma estável pela rodada e pelo jogador: a mesma em todo aparelho e a
 * cada vez que a carta abre (sem sorteio).
 */
export function flopPhrase(roundId: string, membershipId: string): string {
  let hash = 0;
  for (const ch of `${roundId}:${membershipId}`) hash = (hash * 31 + ch.codePointAt(0)!) >>> 0;
  return FLOP_PHRASES[hash % FLOP_PHRASES.length]!;
}
