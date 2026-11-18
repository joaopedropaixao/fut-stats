import type { ErrorEvent, EventHint, NodeOptions } from '@sentry/nestjs';

type SentrySdk = typeof import('@sentry/nestjs');

/**
 * Monitoramento de erros (Sentry). Só existe com `SENTRY_DSN`: sem ele o pacote nem é carregado (`require` preguiçoso)
 * e todas as funções abaixo viram no-op. Só vai o que é erro de verdade (5xx e falha não tratada) e, de pessoa,
 * apenas o id do usuário. Passo a passo e como ler um evento em docs/deploy.md.
 */
let sdk: SentrySdk | undefined;

function loadSdk(): SentrySdk {
  // Preguiçoso de propósito: com o Sentry desligado (dev, testes, staging sem DSN) a API não paga o carregamento.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  sdk ??= require('@sentry/nestjs') as SentrySdk;
  return sdk;
}

export interface MonitoringOptions {
  /** Sem DSN o Sentry não é iniciado. */
  dsn: string | undefined;
  environment: string;
  /** Só para testes: troca o envio pela rede (um gravador). */
  transport?: NodeOptions['transport'];
}

/** Opções a partir das variáveis de ambiente: vazio vale como ausente; o ambiente cai em `NODE_ENV`. */
export function monitoringOptionsFromEnv(env: NodeJS.ProcessEnv): MonitoringOptions {
  return {
    dsn: env.SENTRY_DSN || undefined,
    environment: env.SENTRY_ENVIRONMENT || env.NODE_ENV || 'production',
  };
}

/**
 * Tira do evento tudo que não seja o id do usuário: cookies, cabeçalhos, corpo, IP e query do pedido (`request`),
 * o resto do `user` (email, nome, IP) e os rastros de console (`breadcrumbs`, que podem carregar texto de log).
 */
export function scrubEvent<T extends ErrorEvent>(event: T): T {
  delete event.request;
  delete event.breadcrumbs;
  // Mensagem simples ("API no ar") sai sem a pilha sintética que o SDK cola nela (caminhos de arquivo do servidor).
  if (event.message && event.exception?.values?.every((value) => value.mechanism?.synthetic)) {
    delete event.exception;
  }
  const id = event.user?.id;
  if (id !== undefined) event.user = { id };
  else delete event.user;
  return event;
}

/**
 * Liga o Sentry (chamar antes do `NestFactory`). Devolve `true` se ligou. Sem DSN, não faz nada.
 *
 * Só a parte de captura: uma lista curta de integrações, sem a instrumentação de http/express/pg (o @sentry/nestjs 11
 * já não liga o OpenTelemetry por padrão; o plano gratuito do Render, com 512 MB, não precisa do resto: o desempenho já
 * tem `durationMs` no log de pedido). Sem dados pessoais e sem rastreamento de desempenho.
 */
export function initMonitoring({ dsn, environment, transport }: MonitoringOptions): boolean {
  if (!dsn) return false;
  const Sentry = loadSdk();
  Sentry.init({
    dsn,
    environment,
    // Equivale ao antigo `sendDefaultPii: false` (o @sentry/nestjs 11 trocou a opção por `dataCollection`): nada de
    // usuário automático, cookie, cabeçalho, corpo, query, variáveis locais nem linhas de código no evento.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      stackFrameVariables: false,
      frameContextLines: 0,
    },
    tracesSampleRate: 0,
    defaultIntegrations: false,
    integrations: [
      Sentry.functionToStringIntegration(),
      Sentry.linkedErrorsIntegration(),
      Sentry.onUncaughtExceptionIntegration(),
      Sentry.onUnhandledRejectionIntegration(),
      Sentry.nodeContextIntegration(),
    ],
    maxBreadcrumbs: 0,
    beforeSend: (event: ErrorEvent, _hint: EventHint) => scrubEvent(event),
    ...(transport ? { transport } : {}),
  });
  return true;
}

export function isMonitoringOn(): boolean {
  return sdk?.isInitialized() ?? false;
}

/** Quem estava no pedido, vindo do contexto (`request-context`). */
export interface ErrorContext {
  requestId: string | null;
  groupId?: string;
  userId?: string;
}

/** Manda um erro de verdade (5xx ou não tratado) com as tags do pedido e o id do usuário. No-op com o Sentry desligado. */
export function captureServerError(error: unknown, context: ErrorContext): void {
  if (!sdk?.isInitialized()) return;
  const tags: Record<string, string> = {};
  if (context.requestId) tags.requestId = context.requestId;
  if (context.groupId) tags.groupId = context.groupId;
  sdk.captureException(error, {
    tags,
    ...(context.userId ? { user: { id: context.userId } } : {}),
  });
}

/** Mensagem info "API no ar" (uma por subida): prova no Sentry que o deploy novo está ligado. */
export function announceStartup(): void {
  if (!sdk?.isInitialized()) return;
  sdk.captureMessage('API no ar', 'info');
}

/** Espera os eventos pendentes saírem (antes de desligar, e nos testes). */
export async function flushMonitoring(timeoutMs = 2000): Promise<void> {
  if (sdk?.isInitialized()) await sdk.flush(timeoutMs);
}

/** Desliga o Sentry (nos testes, para o próximo arquivo começar do zero). */
export async function closeMonitoring(): Promise<void> {
  if (sdk?.isInitialized()) await sdk.close(2000);
}
