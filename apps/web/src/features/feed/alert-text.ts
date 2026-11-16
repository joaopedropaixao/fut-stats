import { FEED_ALERT_LABELS, TEAM_LABELS, type FeedAlert } from '@fut-stats/shared';

/** O que a linha de aviso escreve e para onde leva. O estado de cada pessoa vem da API (`me`); aqui só se escolhe a frase. */
export type AlertText = {
  /** O tipo, escrito ("Votação aberta"). */
  title: string;
  /** A situação curta ("Falta o seu voto"). */
  situation: string;
  /** A tela do tipo. */
  to: string;
};

/**
 * `resultOpened`: o resultado que a pessoa já abriu neste aparelho vira "Resultado · Rodada 12" e leva ao mesmo
 * lugar. Sem `me` no tipo (a API só manda o que faz sentido), cai na frase neutra.
 */
export function alertText(alert: FeedAlert, resultOpened = false): AlertText {
  const { type, roundId, roundNumber, me } = alert;
  const round = `Rodada ${roundNumber}`;
  const title = FEED_ALERT_LABELS[type];

  switch (type) {
    case 'IN_PROGRESS':
      return {
        title,
        situation: me.team
          ? `${round} · você joga no ${TEAM_LABELS[me.team]}`
          : `${round} · a bola está rolando`,
        to: `/rodadas/${roundId}/jogo`,
      };
    case 'POST_MATCH':
      return {
        title,
        situation: me.team
          ? `${round} · lance seus gols e assistências`
          : `${round} · confira os lances`,
        to: `/rodadas/${roundId}/jogo`,
      };
    case 'RESULT':
      return {
        title: resultOpened ? 'Resultado' : title,
        situation: resultOpened ? round : `${round} · abra o pacote`,
        to: `/rodadas/${roundId}/resultado`,
      };
    case 'VOTING':
      return {
        title,
        situation:
          me.played === false
            ? `${round} · só quem jogou vota`
            : me.voted
              ? `${round} · você já votou`
              : `${round} · falta o seu voto`,
        to: `/rodadas/${roundId}/votar`,
      };
    case 'TEAMS_PUBLISHED':
      return {
        title,
        situation: me.team
          ? `${round} · você joga no ${TEAM_LABELS[me.team]}`
          : `${round} · você não está escalado`,
        to: '/times',
      };
    case 'PRESENCE':
      return {
        title,
        situation:
          me.attendance === true
            ? `${round} · você vai`
            : me.attendance === false
              ? `${round} · você não vai`
              : `${round} · responda`,
        to: `/rodadas/${roundId}`,
      };
  }
}

/** O nome do aviso inteiro para o leitor de tela: "Votação aberta, rodada 12, falta o seu voto". */
export function alertAriaLabel(text: AlertText): string {
  const [round, ...rest] = text.situation.split(' · ');
  return [text.title, round!.toLowerCase(), ...rest].join(', ');
}

/**
 * Separa o aviso grande das linhas. A API manda a lista na ordem de prioridade; o "já abri o pacote" é por aparelho
 * (`isOpened`): o resultado aberto vira linha e o aviso seguinte sobe para o card grande. Sem aviso que sirva de
 * card (só o resultado aberto), tudo fica em linha.
 */
export function splitAlerts(
  alerts: readonly FeedAlert[],
  isOpened: (alert: FeedAlert) => boolean,
): { big: FeedAlert | undefined; lines: FeedAlert[] } {
  const big = alerts.find((alert) => !(alert.type === 'RESULT' && isOpened(alert)));
  return { big, lines: alerts.filter((alert) => alert !== big) };
}
