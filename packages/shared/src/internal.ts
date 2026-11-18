import { z } from 'zod';

/**
 * Resposta de POST /api/internal/tick: quantas votações vencidas foram fechadas agora e quantas **falharam** ao fechar.
 * Com `failed > 0` a resposta é 500 (o mesmo corpo), para o job do despertador ficar vermelho. Sem dado de grupo.
 */
export const tickResultSchema = z.object({
  closedVotings: z.number().int(),
  failed: z.number().int(),
});

export type TickResult = z.infer<typeof tickResultSchema>;

/** Resposta de POST /api/internal/sentry-check: se o Sentry da API estava ligado e recebeu a mensagem de teste. */
export const sentryCheckResultSchema = z.object({ sent: z.boolean() });

export type SentryCheckResult = z.infer<typeof sentryCheckResultSchema>;
