import type { QueryClient, QueryKey } from '@tanstack/react-query';

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

/**
 * "Tentar de novo" da espera do servidor. No TanStack v5, um `refetch()` de uma consulta sem dado e ainda pendurada
 * reaproveita a mesma promessa (o servidor dormindo nunca respondeu) e nenhuma chamada nova sai. Por isso, só nesse
 * caso (sem dado e buscando) cancela antes, e só essa chave (`exact`): outros observadores não são revertidos. Com o
 * erro já resolvido (o 500), ou com dado em cache, o `refetch()` refaz como sempre.
 */
export async function restartQuery(
  queryClient: QueryClient,
  queryKey: QueryKey,
  refetch: () => unknown,
): Promise<void> {
  const state = queryClient.getQueryState(queryKey);
  if (state?.fetchStatus === 'fetching' && state.data === undefined) {
    await queryClient.cancelQueries({ queryKey, exact: true });
  }
  await refetch();
}
