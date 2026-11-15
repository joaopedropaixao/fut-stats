import {
  ROUND_STATUS_LABELS,
  TEAM_LABELS,
  type HistoryItem,
  type MatchResult,
  type MatchScore,
  type RoundDetail,
} from '@fut-stats/shared';

type Me = HistoryItem['me'];
export type ResultKind = MatchResult | 'NONE';

/**
 * A partida já tem placar final para mostrar (Resenha, votação ou encerrada)? É o mesmo recorte do `isMatchFinished`
 * do domain, que a API usa para montar a lista: o web não depende do domain, então o recorte fica escrito aqui.
 */
export function isMatchFinished(status: RoundDetail['status']): boolean {
  return status === 'POST_MATCH' || status === 'VOTING' || status === 'CLOSED';
}

/** O resultado de quem vê, curto, para a faixa do card da lista. O resultado vem da API; aqui só se escolhe a frase. */
export function listResultText(me: Me): { kind: ResultKind; text: string } {
  if (!me) return { kind: 'NONE', text: 'Você não jogou' };
  if (me.result === 'WIN') return { kind: 'WIN', text: 'Você venceu' };
  if (me.result === 'LOSS') return { kind: 'LOSS', text: 'Você perdeu' };
  return { kind: 'DRAW', text: 'Empate' };
}

/** A frase da faixa do detalhe: o placar começa pelo time de quem vê ("Você venceu 3 a 2 no Branco"). */
export function detailResultText(me: Me, score: MatchScore): string {
  if (!me) return 'Você não jogou esta partida';
  const other = me.team === 'WHITE' ? 'BLACK' : 'WHITE';
  const pair = `${score[me.team]} a ${score[other]} no ${TEAM_LABELS[me.team]}`;
  if (me.result === 'WIN') return `Você venceu ${pair}`;
  if (me.result === 'LOSS') return `Você perdeu ${pair}`;
  return `Empate em ${pair}`;
}

const WEEKDAYS = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
] as const;
const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
] as const;

/** "sábado 17 de outubro", por extenso, para leitor de tela (no fuso do aparelho). */
export function formatLongDay(date: Date): string {
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} de ${MONTHS[date.getMonth()]}`;
}

/**
 * O nome do card inteiro (o card é um link só): "Rodada 12, sábado 17 de outubro, Branco 3, Preto 2, você venceu".
 * Partida na Resenha ou na votação diz a etapa no fim.
 */
export function cardAriaLabel(item: HistoryItem): string {
  const result = listResultText(item.me).text.toLowerCase();
  const stage = item.status === 'POST_MATCH' || item.status === 'VOTING';
  return [
    `Rodada ${item.number}`,
    formatLongDay(new Date(item.scheduledAt)),
    `Branco ${item.score.WHITE}`,
    `Preto ${item.score.BLACK}`,
    result,
    ...(stage ? [ROUND_STATUS_LABELS[item.status]] : []),
  ].join(', ');
}
