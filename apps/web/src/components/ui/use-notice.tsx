import { useCallback, useEffect, useRef, useState } from 'react';
import { Notice, type NoticeData } from './notice';

const AUTO_CLOSE_MS = { success: 5000, error: 8000 } as const;

/** Um aviso por vez: `show` troca o que estiver na tela; some sozinho. */
export function useNotice() {
  const [notice, setNotice] = useState<NoticeData | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const dismiss = useCallback(() => {
    clearTimeout(timer.current);
    setNotice(null);
  }, []);

  const show = useCallback((next: NoticeData) => {
    clearTimeout(timer.current);
    setNotice(next);
    timer.current = setTimeout(() => setNotice(null), AUTO_CLOSE_MS[next.kind]);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return {
    show,
    dismiss,
    node: notice && <Notice {...notice} onClose={dismiss} />,
  };
}
