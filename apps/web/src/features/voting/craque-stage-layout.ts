/**
 * As larguras do palco do Craque na página do resultado. A linha das cartas tem largura real (`w-full`): o palco é
 * uma coluna `items-center`, e sem isso o `flex-wrap` encolhia ao conteúdo e o `w-full` da coluna do Craque sozinho
 * virava 240 px (banner e tecla estreitos). Sozinho: a carta Lenda tem 240 px (centrada) e a coluna alarga até
 * `max-w-xs` (320 px) para o banner e a tecla Compartilhar; empate: uma coluna de 240 px por Craque.
 */
export const CRAQUE_ROW = 'flex w-full flex-wrap items-start justify-center gap-x-5 gap-y-8';

export function craqueColumn(tie: boolean): string {
  return `flex max-w-full flex-col items-center gap-5 ${
    tie ? 'w-60' : 'w-60 min-[360px]:w-full min-[360px]:max-w-xs'
  }`;
}
