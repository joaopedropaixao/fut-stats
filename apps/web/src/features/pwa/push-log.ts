/**
 * Registra no console uma falha dos avisos push. Só o nome e a mensagem do erro: nunca o endereço da assinatura, as
 * chaves nem dado da pessoa (quem lê o console é quem está testando, e o erro real é o que diz o que quebrou).
 */
export function logPushError(scope: 'enable' | 'disable' | 'sync', error: unknown): void {
  const detail =
    error instanceof Error ? `${error.name}: ${error.message}` : 'erro que não é um Error';
  console.error(`[push] ${scope} falhou: ${detail}`);
}
