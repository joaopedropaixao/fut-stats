import { useSyncExternalStore } from 'react';
import type { ChannelMode } from './stream-state';

/**
 * Em que modo está o canal de cada rodada. Quem abre o canal (`use-round-stream`) escreve; as consultas do jogo e
 * da votação leem para escolher o intervalo. Sem canal para a rodada, vale o modo antigo.
 */
const modes = new Map<string, ChannelMode>();
const listeners = new Set<() => void>();

export function subscribeChannelModes(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** `null` tira a rodada do registro (canal fechado). */
export function setChannelMode(roundId: string, mode: ChannelMode | null): void {
  if ((modes.get(roundId) ?? null) === mode) return;
  if (mode === null) modes.delete(roundId);
  else modes.set(roundId, mode);
  listeners.forEach((listener) => listener());
}

export function getChannelMode(roundId: string | undefined): ChannelMode {
  return (roundId !== undefined && modes.get(roundId)) || 'polling';
}

/** O modo do canal da rodada; `polling` quando não há canal. */
export function useChannelMode(roundId: string | undefined): ChannelMode {
  return useSyncExternalStore(subscribeChannelModes, () => getChannelMode(roundId));
}
