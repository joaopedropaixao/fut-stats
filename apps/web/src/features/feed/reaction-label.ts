import { POST_REACTION_LABELS, type PostReaction } from '@fut-stats/shared';

/** O nome do botão de reação para o leitor de tela: "Bagre, 3 reações, a sua". */
export function reactionAriaLabel(reaction: PostReaction, count: number, mine: boolean): string {
  const total = `${count} ${count === 1 ? 'reação' : 'reações'}`;
  return `${POST_REACTION_LABELS[reaction]}, ${total}${mine ? ', a sua' : ''}`;
}

/** Nomes que não cabem no botão de 46 px (320 px) ganham uma forma curta; o nome inteiro segue no `title` e no leitor de tela. */
const SHORT_NAMES: Partial<Record<PostReaction, string>> = { YELLOW_CARD: 'Cartão' };

/** O nome que aparece embaixo do ícone da reação. */
export function reactionShortName(reaction: PostReaction): string {
  return SHORT_NAMES[reaction] ?? POST_REACTION_LABELS[reaction];
}
