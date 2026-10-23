import { z } from 'zod';

/** Variáveis de ambiente da API. A app não sobe se alguma estiver inválida. */
export const envSchema = z.object({
  // Sem NODE_ENV, vale `production`: o cookie de sessão só sai sem `Secure` quando alguém pede dev/test.
  NODE_ENV: z.enum(['development', 'test', 'production']).default('production'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  /** Assina o JWT da sessão. Trocar o segredo desloga todo mundo. */
  JWT_SECRET: z.string().min(32),
  /** Quantos dias a sessão vale depois do login. */
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Variáveis de ambiente inválidas:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
