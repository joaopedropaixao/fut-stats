/** Os três degraus do pódio do ranking. */
export type PodiumTier = 'gold' | 'silver' | 'bronze';

/**
 * O degrau do pódio de uma posição (1º ouro, 2º prata, 3º bronze); fora do top 3, ou sem posição, nenhum. Empate divide a
 * posição na API, então quem empata em 2º ganha a mesma medalha.
 */
export function podiumTier(rank: number | null): PodiumTier | null {
  if (rank === 1) return 'gold';
  if (rank === 2) return 'silver';
  if (rank === 3) return 'bronze';
  return null;
}

export const PODIUM_NAME: Record<PodiumTier, string> = {
  gold: 'ouro',
  silver: 'prata',
  bronze: 'bronze',
};

/** "1º lugar, ouro": o nome da medalha para leitor de tela (a cor nunca é o único sinal). */
export function podiumLabel(rank: number): string | null {
  const tier = podiumTier(rank);
  return tier ? `${rank}º lugar, ${PODIUM_NAME[tier]}` : null;
}

/** A cor do número do degrau (o bronze usa a faixa clara, para o contraste do número no fundo verde). */
export const PODIUM_TEXT: Record<PodiumTier, string> = {
  gold: 'text-gold',
  silver: 'text-silver',
  bronze: 'text-bronze-light',
};
