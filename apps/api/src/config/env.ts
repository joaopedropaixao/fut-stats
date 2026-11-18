import { z } from 'zod';

/** Valor vazio (`VAPID_PUBLIC_KEY=` no `.env.example`) vale como variável ausente. */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());

/**
 * Confere o formato de uma chave VAPID sem nunca devolver o valor (é segredo): `base64url` puro (sem aspas, espaço,
 * `=` de preenchimento nem `+`/`/`) que decodifica para `bytes` bytes (e, na pública, começa com 0x04).
 * O que o `web-push` gera com `npx web-push generate-vapid-keys` passa; um valor colado errado não, e a API não sobe
 * em vez de assinar com uma chave que o serviço de push (Google, Apple, Mozilla) recusaria.
 */
function vapidKey(name: string, bytes: number, uncompressedPoint: boolean) {
  return z
    .string()
    .min(1)
    .superRefine((value, ctx) => {
      const fail = (message: string) =>
        ctx.addIssue({ code: 'custom', message: `${name}: ${message}` });
      if (/["'\s]/.test(value)) {
        fail('tem aspas ou espaço; cole só a chave, sem aspas e sem espaço antes ou depois');
        return;
      }
      if (!/^[A-Za-z0-9_-]+$/.test(value)) {
        fail(
          'não é base64url (só letras, números, "-" e "_", sem "=" no fim); copie de novo a chave gerada',
        );
        return;
      }
      const decoded = Buffer.from(value, 'base64url');
      if (decoded.length !== bytes) {
        fail(
          `decodifica para ${decoded.length} bytes e deveria ter ${bytes}; a chave está cortada ou é de outro tipo`,
        );
        return;
      }
      if (uncompressedPoint && decoded[0] !== 0x04)
        fail(
          'não é uma chave pública P-256 (deveria começar com o byte 0x04); confira se não é a privada',
        );
    });
}

const VAPID_KEYS = ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'] as const;

/** Variáveis de ambiente da API. A app não sobe se alguma estiver inválida. */
export const envSchema = z
  .object({
    // Sem NODE_ENV, vale `production`: o cookie de sessão só sai sem `Secure` quando alguém pede dev/test.
    NODE_ENV: z.enum(['development', 'test', 'production']).default('production'),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    /** Assina o JWT da sessão. Trocar o segredo desloga todo mundo. */
    JWT_SECRET: z.string().min(32),
    /** Quantos dias a sessão vale depois do login. */
    SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),
    /**
     * De quantos em quantos milissegundos o relógio da API fecha votações vencidas. Padrão 60 000 (1 minuto);
     * `0` desliga (os testes). Fechar também acontece no último voto e ao abrir o app depois do prazo.
     */
    VOTING_CLOSER_INTERVAL_MS: z.coerce.number().int().min(0).default(60_000),
    /** Intervalo do `: ping` do canal ao vivo, em ms (mantém a conexão viva atrás de proxy). Padrão 20 000. */
    STREAM_HEARTBEAT_MS: z.coerce.number().int().positive().default(20_000),
    /** Credenciais do client OAuth "Web application" do Google Cloud. */
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
    /**
     * Endereço público do app, onde o navegador está (Vercel em staging, Vite em dev). A callback do Google
     * sai dele, nunca do host da requisição: `${APP_URL}/api/auth/google/callback`.
     */
    APP_URL: z.url({ protocol: /^https?$/ }).transform((url) => url.replace(/\/+$/, '')),
    /**
     * Avisos push (Web Push): as três juntas ou nenhuma. Sem elas o push fica desligado (`/push/config` diz
     * `enabled: false`) e nenhuma ação tenta enviar. Gerar: `npx web-push generate-vapid-keys` (docs/deploy.md).
     */
    VAPID_PUBLIC_KEY: optional(vapidKey('VAPID_PUBLIC_KEY', 65, true)),
    VAPID_PRIVATE_KEY: optional(vapidKey('VAPID_PRIVATE_KEY', 32, false)),
    /** Contato do dono para o serviço de push: `mailto:` ou `https:`. */
    VAPID_SUBJECT: optional(
      z
        .string()
        .regex(
          /^(mailto:[^\s"']+|https:\/\/[^\s"']+)$/,
          'VAPID_SUBJECT: use mailto:voce@exemplo.com ou https://seu-site (sem aspas e sem espaço)',
        ),
    ),
    /**
     * Sentry da API (Render). Sem DSN o Sentry nem é iniciado. Passo a passo em docs/deploy.md.
     * `SENTRY_ENVIRONMENT` (`staging` ou `production`) etiqueta os eventos; sem ele vale `NODE_ENV`.
     */
    SENTRY_DSN: optional(z.url({ protocol: /^https?$/ })),
    SENTRY_ENVIRONMENT: optional(z.string().min(1)),
    /**
     * Segredo do despertador (`POST /api/internal/tick`, `Authorization: Bearer`). Só na produção: sem ele a rota
     * não existe (404). Mínimo de 32 caracteres; gerar com `openssl rand -base64 48`.
     */
    TICK_SECRET: optional(z.string().min(32)),
  })
  .superRefine((env, ctx) => {
    const set = VAPID_KEYS.filter((key) => env[key] !== undefined);
    if (set.length === 0 || set.length === VAPID_KEYS.length) return;
    for (const key of VAPID_KEYS.filter((k) => env[k] === undefined)) {
      ctx.addIssue({
        code: 'custom',
        path: [key],
        message: `falta ${key}: as três variáveis VAPID vão juntas ou nenhuma`,
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Variáveis de ambiente inválidas:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
