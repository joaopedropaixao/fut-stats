import type { VotingView } from '@fut-stats/shared';
import { useEffect, useMemo, useState } from 'react';
import { clockOffset, remainingMs } from './deadline';

/**
 * Quanto falta para o prazo da votação (ms), no relógio da API, atualizado a cada 20 s. `updatedAt` é a hora em
 * que a visão chegou (o `dataUpdatedAt` da consulta): dali sai a diferença entre o relógio do aparelho e o da API.
 */
export function useCountdown(
  view: Pick<VotingView, 'deadline' | 'serverTime'>,
  updatedAt: number,
): number | null {
  const offset = useMemo(
    () => clockOffset(view.serverTime, updatedAt),
    [view.serverTime, updatedAt],
  );
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 20_000);
    return () => clearInterval(timer);
  }, []);
  return remainingMs(view.deadline, offset, now);
}
