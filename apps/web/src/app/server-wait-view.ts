/**
 * Quando o app abre e a API está dormindo (Render gratuito), o primeiro `GET /api/me` leva até ~1 min. Limiares em
 * ms, ajustáveis: até `startingAfter` o esqueleto de sempre (resposta rápida não pisca); depois, a tela
 * "Servidor iniciando"; com `noticeAfter` entra o "Pode levar até 1 min"; com `giveUpAfter` (ou se o pedido falhar de
 * vez) vira o erro com "Tentar de novo".
 */
export const SERVER_WAIT = {
  startingAfter: 3000,
  noticeAfter: 10000,
  giveUpAfter: 90000,
} as const;

export type ServerWaitView = 'skeleton' | 'starting' | 'error';

/** O que a tela mostra enquanto o /me não voltou, pelos temporizadores e pela falha do pedido. */
export function serverWaitView(state: {
  /** O pedido falhou (depois das retentativas). */
  failed: boolean;
  /** Passou de `giveUpAfter` sem resposta. */
  gaveUp: boolean;
  /** Passou de `startingAfter` sem resposta. */
  startingElapsed: boolean;
  /** Já tocou em "Tentar de novo": volta direto para "Servidor iniciando", sem esperar os 3 s de novo. */
  retried: boolean;
}): ServerWaitView {
  if (state.failed || state.gaveUp) return 'error';
  if (state.startingElapsed || state.retried) return 'starting';
  return 'skeleton';
}

/**
 * A bola da reação das resenhas (`REACTION_SPRITES.BALL`, o teste confere que é a mesma grade). Fica copiada aqui de
 * propósito: `pixel-sprite-maps` puxa o avatar e o `shared` para o pedaço inicial (+36 kB gzip), e esta tela mora
 * nele. Uma letra por cor: K contorno, W branco.
 */
export const SERVER_WAIT_BALL = [
  '...KKKKKK...',
  '..KWWKKWWK..',
  '.KWWKKKKWWK.',
  'KWWWWKKWWWWK',
  'KWKWWWWWWKWK',
  'KKKKWWWWKKKK',
  'KKKKWWWWKKKK',
  'KWKWWWWWWKWK',
  'KWWWWKKWWWWK',
  '.KWWKKKKWWK.',
  '..KWWKKWWK..',
  '...KKKKKK...',
] as const;
