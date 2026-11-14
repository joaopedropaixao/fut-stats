/**
 * Pedaço de tela que sumiu (deploy novo com a aba aberta: o arquivo com hash antigo não existe mais).
 * A primeira falha recarrega a página; a marca em sessionStorage impede o laço de recarga se falhar de novo.
 * A marca sai quando uma navegação dá certo (main.tsx).
 */
const MARK = 'fut-stats:chunk-reload';

const CHUNK_ERROR =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/i;

type MarkStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** O erro é de um .js carregado sob demanda que não veio (e não de um erro de código da tela)? */
export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return CHUNK_ERROR.test(message);
}

/** Recarrega a página se ainda não recarregou nesta sessão. Devolve `true` se mandou recarregar. */
export function reloadOnce(
  reload: () => void = () => window.location.reload(),
  storage: MarkStorage | null = browserStorage(),
): boolean {
  // Sem como guardar a marca, não arrisca o laço
  if (!storage) return false;
  try {
    if (storage.getItem(MARK)) return false;
    storage.setItem(MARK, '1');
  } catch {
    return false;
  }
  reload();
  return true;
}

/** Uma navegação deu certo: o próximo pedaço que sumir ganha uma nova recarga. */
export function clearReloadMark(storage: MarkStorage | null = browserStorage()) {
  try {
    storage?.removeItem(MARK);
  } catch {
    // sem storage: nada a limpar
  }
}

/** O Vite avisa quando um import dinâmico falha: recarrega uma vez (se já recarregou, deixa o erro seguir). */
export function reloadOnPreloadError() {
  window.addEventListener('vite:preloadError', (event) => {
    if (reloadOnce()) event.preventDefault();
  });
}

function browserStorage(): MarkStorage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}
