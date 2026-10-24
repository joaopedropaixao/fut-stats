import { useSyncExternalStore } from 'react';
import { useSession } from '../session/use-session';

/** Onde o aparelho guarda o grupo escolhido. */
const STORAGE_KEY = 'fut-stats:grupo-atual';

let memoryId: string | null = null;
const listeners = new Set<() => void>();

function readStoredId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): string | null {
  return memoryId ?? readStoredId();
}

/** Troca o grupo atual (fica salvo no aparelho). Chame depois de criar ou entrar num grupo. */
export function setCurrentGroupId(groupId: string): void {
  memoryId = groupId;
  try {
    localStorage.setItem(STORAGE_KEY, groupId);
  } catch {
    // Sem storage (aba anônima, bloqueio): vale só nesta visita.
  }
  listeners.forEach((listener) => listener());
}

/**
 * O grupo em que o usuário está agora, a partir do GET /api/me: o escolhido no aparelho, se ele ainda é membro;
 * senão o primeiro. `group` é `null` quando não há sessão ou o usuário ainda não está em nenhum grupo.
 */
export function useCurrentGroup() {
  const session = useSession();
  const storedId = useSyncExternalStore(subscribe, getSnapshot);
  const groups = session.data?.groups ?? [];
  const group = groups.find((g) => g.id === storedId) ?? groups[0] ?? null;
  return { ...session, groups, group };
}
