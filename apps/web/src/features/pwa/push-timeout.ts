/**
 * Quanto esperar o navegador assinar (`pushManager.subscribe`). Num perfil novo o Chrome já levou de 24 a 32 s
 * para responder, então o limite fica folgado: só estoura quando o navegador realmente travou.
 */
export const SUBSCRIBE_TIMEOUT_MS = 60_000;

/** O navegador não respondeu a tempo. A tela troca "Ligando…" pela mensagem de "demorou". */
export class PushTimeoutError extends Error {
  override name = 'PushTimeoutError';

  constructor(timeoutMs: number) {
    super(`o navegador não terminou em ${timeoutMs} ms`);
  }
}

/**
 * Espera `promise` por até `timeoutMs`; passado o tempo rejeita com `PushTimeoutError`. Se ela terminar bem
 * depois disso, entrega o valor tardio a `onLate`: quem chama desfaz o que a operação criou (senão fica uma
 * assinatura órfã, que a pessoa nunca viu ligar). Falha tardia é descartada: não há o que desfazer.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  onLate: (value: T) => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let expired = false;
    const timer = setTimeout(() => {
      expired = true;
      reject(new PushTimeoutError(timeoutMs));
    }, timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        if (expired) onLate(value);
        else resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        if (!expired) reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}
