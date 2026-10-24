/** Onde o app guarda o convite que a pessoa estava abrindo antes de ir logar no Google. */
const PENDING_KEY = 'fut-stats:destino-pos-login';

/**
 * Aceita o link inteiro (`https://app/convite/abc123`), o caminho (`/convite/abc123`) ou só o código.
 * Devolve o código ou `null` se não sobrou nada aproveitável.
 */
export function extractInviteCode(input: string): string | null {
  const text = input.trim();
  const fromLink = /\/convite\/([^/?#\s]+)/.exec(text);
  const code = fromLink ? fromLink[1]! : text;
  return /^[\w-]+$/.test(code) ? code : null;
}

/** Só destinos internos de convite são aceitos (evita redirecionar para fora do app). */
export function isInvitePath(path: string | null | undefined): path is string {
  return !!path && /^\/convite\/[\w-]+$/.test(path);
}

/** Guarda o destino antes de sair para o Google. */
export function savePendingDestination(path: string): void {
  try {
    sessionStorage.setItem(PENDING_KEY, path);
  } catch {
    // Sem storage: a pessoa volta para o início e cola o link de novo.
  }
}

/** Lê o destino guardado, sem apagar (é seguro chamar durante a renderização). */
export function peekPendingDestination(): string | null {
  try {
    const path = sessionStorage.getItem(PENDING_KEY);
    return isInvitePath(path) ? path : null;
  } catch {
    return null;
  }
}

/** Apaga o destino guardado: a tela do convite chama ao abrir, já que o retorno do login chegou nela. */
export function clearPendingDestination(): void {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // Sem storage: não há o que apagar.
  }
}

/** Link de convite completo, para copiar e compartilhar. */
export function inviteUrl(origin: string, code: string): string {
  return `${origin}/convite/${code}`;
}

/** Link do WhatsApp com a mensagem pronta. */
export function whatsappShareUrl(groupName: string, link: string): string {
  const text = `Bora jogar bola? Entre na pelada ${groupName}: ${link}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
