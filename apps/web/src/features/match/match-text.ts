import type { MatchView } from '@fut-stats/shared';

// O shared ainda não exporta MatchResult nem MatchScore: derivados da visão.
type MatchResult = NonNullable<MatchView['me']['result']>;
type MatchScore = NonNullable<MatchView['score']>;

type Team = 'WHITE' | 'BLACK';

/** "2 de 3 gols": quantos gols do time já têm autor, perto do placar dele. Sem placar, só a contagem. */
export function goalsOfScore(goals: number, scored: number | undefined): string {
  const noun = (scored ?? goals) === 1 ? 'gol' : 'gols';
  return scored === undefined ? `${goals} ${noun}` : `${goals} de ${scored} ${noun}`;
}

/** O quadro final do card de resultado, dito para leitor de tela: o placar começa pelo time de quem vê. */
export function resultAnnouncement(result: MatchResult, score: MatchScore, myTeam: Team): string {
  const other: Team = myTeam === 'WHITE' ? 'BLACK' : 'WHITE';
  const pair = `${score[myTeam]} a ${score[other]}`;
  if (result === 'WIN') return `Você venceu ${pair}`;
  if (result === 'LOSS') return `Você perdeu ${pair}`;
  return `Empate em ${pair}`;
}
