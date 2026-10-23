import {
  POSITION_LABELS,
  TEAM_LABELS,
  type HistoryDetail,
  type HistoryItem,
  type HistoryPlayer,
} from '@fut-stats/shared';
import { pluralize } from './format';

/** Branco ou Preto (o shared não exporta o tipo do domain; vem do contrato). */
export type Team = keyof HistoryDetail['teams'];

/** O resultado por escrito: "Branco venceu", "Empate", "Em jogo" ou "Sem placar". */
export function resultLabel({ winner, status }: Pick<HistoryItem, 'winner' | 'status'>): string {
  if (winner === 'DRAW') return 'Empate';
  if (winner) return `${TEAM_LABELS[winner]} venceu`;
  return status === 'IN_PROGRESS' ? 'Em jogo' : 'Sem placar';
}

/**
 * Onde cada posição fica no campo de 358 × 480 da folha (ataque em cima, goleiro embaixo). Mesmo desenho do
 * campo de montar os times: alas abertos e o meia um pouco atrás, para os nomes não se encostarem.
 */
const SPOTS: Record<HistoryPlayer['position'], readonly { left: string; top: number }[]> = {
  FORWARD: [{ left: '50%', top: 30 }],
  WINGER: [
    { left: '18.4%', top: 160 },
    { left: '77.1%', top: 160 },
  ],
  MIDFIELDER: [{ left: '50%', top: 196 }],
  DEFENDER: [
    { left: '27.9%', top: 296 },
    { left: '72.1%', top: 296 },
  ],
  GOALKEEPER: [{ left: '50%', top: 392 }],
};

/** Encaixa os titulares nas vagas da posição deles. Quem não couber (escalação fora do 1-2-3-1) sobra. */
export interface PlacedPlayer {
  player: HistoryPlayer;
  left: string;
  top: number;
}

export function placeOnPitch(starters: readonly HistoryPlayer[]): {
  placed: PlacedPlayer[];
  leftover: HistoryPlayer[];
} {
  const used = new Map<HistoryPlayer['position'], number>();
  const placed: PlacedPlayer[] = [];
  const leftover: HistoryPlayer[] = [];
  for (const player of starters) {
    const index = used.get(player.position) ?? 0;
    const spot = SPOTS[player.position][index];
    used.set(player.position, index + 1);
    if (spot) placed.push({ player, ...spot });
    else leftover.push(player);
  }
  return { placed, leftover };
}

/** "Atacante: Nico, 3 gols e 1 assistência" (o que o leitor de tela fala de cada vaga). */
export function playerSummary(player: HistoryPlayer): string {
  const stats = [
    player.goals > 0 && pluralize(player.goals, 'gol', 'gols'),
    player.assists > 0 && pluralize(player.assists, 'assistência', 'assistências'),
  ].filter(Boolean);
  return `${POSITION_LABELS[player.position]}: ${player.nickname}${stats.length ? `, ${stats.join(' e ')}` : ''}`;
}
