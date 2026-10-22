/**
 * Resposta de uma validação que transforma a entrada: o valor validado ou a lista de problemas.
 * O domínio não lança erro; quem decide como reagir (400, mensagem na tela) é a borda.
 */
export type Result<T, E> = { ok: true; value: T } | { ok: false; errors: E[] };
