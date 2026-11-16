import { POST_REACTION_LABELS, type PostReaction } from '@fut-stats/shared';

/** O nome do botão de reação para o leitor de tela: "Fogo, 3 reações, a sua". */
export function reactionAriaLabel(reaction: PostReaction, count: number, mine: boolean): string {
  const total = `${count} ${count === 1 ? 'reação' : 'reações'}`;
  return `${POST_REACTION_LABELS[reaction]}, ${total}${mine ? ', a sua' : ''}`;
}
