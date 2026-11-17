import { z } from 'zod';

/**
 * Canal ao vivo da rodada (`GET /groups/:groupId/rounds/:roundId/stream`, Server-Sent Events). O aviso não carrega
 * dado: só diz que algo mudou e o quê (`scopes`); cada aparelho busca a própria visão pela rota de sempre.
 */
export const ROUND_STREAM_SCOPES = ['match', 'voting', 'status'] as const;
export type RoundStreamScope = (typeof ROUND_STREAM_SCOPES)[number];

export const roundStreamEventSchema = z.object({
  scopes: z.array(z.enum(ROUND_STREAM_SCOPES)).min(1),
  at: z.iso.datetime(),
});
export type RoundStreamEvent = z.infer<typeof roundStreamEventSchema>;

/** Etapas em que vale manter o canal aberto. */
export const LIVE_ROUND_STATUSES = ['TEAMS_PUBLISHED', 'IN_PROGRESS', 'POST_MATCH', 'VOTING'] as const;
