import { useEffect, useState } from 'react';
import { clockOffset, rotationElapsedMs, synchronizedNow } from './rotation-phase';

/** Relógio local corrigido pelo serverTime mais recente; só atualiza a cada segundo com a aba visível. */
export function useRotationClock(serverTime: string, startedAt: string | null) {
  const [localNow, setLocalNow] = useState(() => Date.now());
  const [offset, setOffset] = useState(() => clockOffset(serverTime, Date.now()));

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const sample = Date.now();
      setLocalNow(sample);
      setOffset(clockOffset(serverTime, sample));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [serverTime]);

  useEffect(() => {
    if (!startedAt) return;
    const tick = () => {
      if (document.visibilityState === 'visible') setLocalNow(Date.now());
    };
    const timer = window.setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [startedAt]);

  const now = synchronizedNow(localNow, offset);
  return { now, elapsedMs: startedAt ? rotationElapsedMs(startedAt, now) : 0 };
}
