/**
 * Ações que entram no registro da rodada (quem fez, o quê e quando): publicar e despublicar os times, começar o
 * jogo, lançar ou corrigir o placar, finalizar, abrir e fechar a votação, lançar e apagar lance.
 *
 * Só o vocabulário: gravar e ler é da API. Fora, de propósito: o voto (é anônimo), presença, rascunho dos times,
 * criar e editar a rodada e o rodízio. Textos em `packages/shared` (`ROUND_LOG_ACTION_LABELS`).
 */
export const ROUND_LOG_ACTIONS = [
  'TEAMS_PUBLISHED',
  'TEAMS_UNPUBLISHED',
  'MATCH_STARTED',
  'SCORE_SET',
  'MATCH_FINISHED',
  'VOTING_OPENED',
  'VOTING_CLOSED',
  'EVENT_LAUNCHED',
  'EVENT_REMOVED',
] as const;

export type RoundLogAction = (typeof ROUND_LOG_ACTIONS)[number];
