import { z } from 'zod';

/** Resposta de POST /api/internal/tick: quantas votações vencidas foram fechadas agora. Sem dado de grupo. */
export const tickResultSchema = z.object({ closedVotings: z.number().int() });

export type TickResult = z.infer<typeof tickResultSchema>;
