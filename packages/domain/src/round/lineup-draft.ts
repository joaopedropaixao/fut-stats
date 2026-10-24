/** Por que o rascunho dos times não pode ser salvo. Textos em `packages/shared`. */
export const LINEUP_DRAFT_ERRORS = [
  'DUPLICATE_PLAYER',
  'POSITION_FULL',
  'TOO_MANY_RESERVES',
] as const;

export type LineupDraftError = (typeof LINEUP_DRAFT_ERRORS)[number];
