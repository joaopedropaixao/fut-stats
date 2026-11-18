import type * as SentryReact from '@sentry/react';
import { isChunkLoadError } from './chunk-reload';

/**
 * Monitoramento de erros (Sentry). Só liga com `VITE_SENTRY_DSN` no build, e o `@sentry/react` entra **só por
 * `import()`**: nenhum byte dele vai no JS inicial (orçamento em `bundle-budget.json`) e, sem DSN, o pedaço nem
 * é pedido. Começa depois da primeira renderização (`startMonitoring` em `main.tsx`).
 *
 * Dado pessoal fica de fora: vai só o id do usuário. Sem email, nome, cookie nem corpo de pedido
 * (`dataCollection` fechado, `beforeSend` abaixo). Sem rastreamento de desempenho e sem gravação de sessão.
 */

type Sentry = Pick<typeof SentryReact, 'init' | 'captureException' | 'setUser'>;

export type MonitoringConfig = {
  dsn: string | undefined;
  environment: string | undefined;
};

type Monitoring = {
  /** Começa a carregar o Sentry (uma vez). Sem DSN, não faz nada. */
  start: () => void;
  /** Repassa o erro ao Sentry (se ligado). Erro de pedaço que sumiu não conta: é deploy novo, não defeito. */
  report: (error: unknown, context?: Record<string, string>) => void;
  /** Quem está logado (só o id), ou `null` ao sair. */
  setUser: (id: string | null) => void;
};

/** O que sai de cada evento: só o id do usuário; nada de cookie, cabeçalho nem corpo. */
export function scrubEvent<T extends SentryReact.ErrorEvent>(event: T): T | null {
  const original = event.exception?.values?.[0]?.value;
  if (original && isChunkLoadError(new Error(original))) return null;
  if (event.user) event.user = event.user.id ? { id: event.user.id } : undefined;
  if (event.request) {
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.data;
  }
  return event;
}

/**
 * O SDK 11 trocou o `sendDefaultPii` por `dataCollection` (o padrão novo coleta tudo): aqui nada vai além do que o
 * app manda de propósito (o erro e o id do usuário). Sem IP, cookie, cabeçalho, corpo de pedido, parâmetro de URL
 * nem variável local.
 */
export const PRIVATE_DATA_COLLECTION = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
  stackFrameVariables: false,
} as const satisfies SentryReact.BrowserOptions['dataCollection'];

export function createMonitoring(
  config: MonitoringConfig,
  load: () => Promise<Sentry>,
): Monitoring {
  const { dsn, environment } = config;
  let ready: Promise<Sentry | null> | null = null;
  let userId: string | null = null;

  function start() {
    if (!dsn || ready) return;
    ready = load()
      .then((sentry) => {
        sentry.init({
          dsn,
          environment,
          dataCollection: PRIVATE_DATA_COLLECTION,
          tracesSampleRate: 0,
          beforeSend: scrubEvent,
        });
        // O usuário pode ter carregado antes do Sentry: o id guardado entra agora
        sentry.setUser(userId ? { id: userId } : null);
        return sentry;
      })
      // Sem o Sentry (rede, bloqueador de anúncios), o app segue sem monitorar
      .catch(() => null);
  }

  return {
    start,
    report(error, context) {
      if (!dsn || isChunkLoadError(error)) return;
      // Um erro que vem antes do início agendado também liga o Sentry: não se perde
      start();
      void ready?.then((sentry) => {
        sentry?.captureException(error, context ? { tags: context } : undefined);
      });
    },
    setUser(id) {
      userId = id;
      void ready?.then((sentry) => sentry?.setUser(id ? { id } : null));
    },
  };
}

// A condição é estática no build (o Vite troca a variável pelo valor): sem DSN o `import()` sai do bundle e o
// pedaço do Sentry nem existe no dist (nem entra no cache do service worker).
const monitoring = createMonitoring(
  {
    dsn: import.meta.env.VITE_SENTRY_DSN || undefined,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
  },
  () =>
    import.meta.env.VITE_SENTRY_DSN
      ? import('./sentry-entry')
      : Promise.reject(new Error('sem DSN')),
);

export const startMonitoring = monitoring.start;
export const reportError = monitoring.report;
export const setMonitoringUser = monitoring.setUser;
