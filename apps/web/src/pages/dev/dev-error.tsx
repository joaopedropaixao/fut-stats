/**
 * Erro de renderização de propósito (só em dev): confere a tela de erro geral e o envio ao Sentry.
 * `/dev/erro` (fora da moldura) e `/dev/erro-na-tela` (dentro do AppShell, com as abas, precisa de sessão).
 */
export function DevErrorPage(): never {
  throw new Error('Erro de teste: renderização forçada em /dev/erro');
}
