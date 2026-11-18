/** Chave da lista do histórico: quem muda uma partida (placar, etapa) invalida por ela. */
export const historyKey = (groupId: string) => ['history', groupId] as const;
