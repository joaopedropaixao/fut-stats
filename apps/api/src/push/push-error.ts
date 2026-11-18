/** O corpo da resposta do serviço de push que vale guardar no log (costuma ser uma frase ou um JSON curto). */
const BODY_MAX = 300;

/** Só o host do endereço: o endereço inteiro identifica o aparelho de alguém. */
export function endpointHost(endpoint: unknown): string | undefined {
  if (typeof endpoint !== 'string') return undefined;
  return /^https?:\/\/([^/?#]*)/i.exec(endpoint)?.[1]?.toLowerCase();
}

function stringField(value: unknown, key: string): string | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const field = (value as Record<string, unknown>)[key];
  return typeof field === 'string' && field !== '' ? field : undefined;
}

function describeOne(error: unknown, depth: number): Record<string, unknown> {
  if (typeof error !== 'object' || error === null) return { message: String(error) };
  const fields = error as Record<string, unknown>;
  const detail: Record<string, unknown> = {
    name: stringField(error, 'name') ?? 'Error',
    message: stringField(error, 'message') ?? '',
  };
  // WebPushError: o serviço de push respondeu com erro.
  if (typeof fields.statusCode === 'number') detail.statusCode = fields.statusCode;
  const body = stringField(error, 'body');
  if (body !== undefined) detail.body = body.slice(0, BODY_MAX);
  const host = endpointHost(fields.endpoint);
  if (host !== undefined) detail.host = host;
  // Erro de rede do Node: `code` (ETIMEDOUT, ENETUNREACH...), `cause` e, no AggregateError, uma lista.
  const code = stringField(error, 'code');
  if (code !== undefined) detail.code = code;
  if (depth < 2) {
    if (fields.cause !== undefined) detail.cause = describeOne(fields.cause, depth + 1);
    if (Array.isArray(fields.errors))
      detail.errors = fields.errors.slice(0, 5).map((inner) => describeOne(inner, depth + 1));
  }
  return detail;
}

/**
 * O que registrar de uma falha de envio, sem segredo: nome, mensagem, `statusCode` e `body` (WebPushError), `code`,
 * `cause` e `errors[]` (rede). Nunca o endereço inteiro do aparelho (só o host) nem as chaves.
 * O `message` de um `AggregateError` de rede vem vazio: o `errors[].code` é que diz o motivo.
 */
export function describePushError(error: unknown): Record<string, unknown> {
  return describeOne(error, 0);
}
