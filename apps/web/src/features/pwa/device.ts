import { isIos } from './install-state';

/** iPhone/iPad, lido do navegador. */
export function detectIos(): boolean {
  return isIos(navigator.userAgent, navigator.platform, navigator.maxTouchPoints);
}

const STANDALONE = '(display-mode: standalone)';

/** O app está aberto como app instalado (Android, desktop e, no iPhone, o `navigator.standalone`). */
export function readStandalone(): boolean {
  try {
    return (
      window.matchMedia(STANDALONE).matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  } catch {
    return false;
  }
}

/** Avisa quando o modo de exibição muda (instalou e abriu como app). */
export function subscribeStandalone(listener: () => void): () => void {
  try {
    const query = window.matchMedia(STANDALONE);
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
  } catch {
    return () => undefined;
  }
}
