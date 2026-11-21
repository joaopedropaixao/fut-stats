import { useEffect, useState } from 'react';

/** Depois de quanto tempo gerando o bloco avisa que o servidor está acordando (o Render gratuito dorme). */
export const SLOW_WAIT_MS = 5000;

/** Agenda o aviso; devolve o cancelamento (limpa o temporizador). */
export function startSlowWait(onSlow: () => void, ms: number = SLOW_WAIT_MS): () => void {
  const id = setTimeout(onSlow, ms);
  return () => clearTimeout(id);
}

/**
 * `true` quando `active` já dura `ms` ou mais. Ao terminar (sucesso ou erro) ou desmontar, o temporizador é
 * limpo e o aviso zera, para a próxima espera começar do zero.
 */
export function useSlowWait(active: boolean, ms: number = SLOW_WAIT_MS): boolean {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!active) return;
    const cancel = startSlowWait(() => setSlow(true), ms);
    return () => {
      cancel();
      setSlow(false);
    };
  }, [active, ms]);
  return active && slow;
}
