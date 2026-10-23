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
  /** Credenciais do client OAuth "Web application" do Google Cloud. */
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  /**
   * Endereço público do app, onde o navegador está (Vercel em staging, Vite em dev). A callback do Google
   * sai dele, nunca do host da requisição: `${APP_URL}/api/auth/google/callback`.
   */
  APP_URL: z.url({ protocol: /^https?$/ }).transform((url) => url.replace(/\/+$/, '')),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Variáveis de ambiente inválidas:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
