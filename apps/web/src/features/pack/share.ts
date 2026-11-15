export type ShareOutcome = 'files' | 'text' | 'whatsapp' | 'cancelled';

export type ShareEnv = {
  /** `navigator.share` e `navigator.canShare`, quando existem. */
  nav: {
    share?: (data: ShareData) => Promise<void>;
    canShare?: (data: ShareData) => boolean;
  };
  /** Abre o link do WhatsApp (sem `share`). */
  open: (url: string) => void;
};

const isAbort = (e: unknown) => e instanceof DOMException && e.name === 'AbortError';

/**
 * Compartilhar a carta: o sistema com a imagem (se aceita arquivo), senão só o texto, senão o link do WhatsApp.
 * Cancelar não é erro (nada acontece). A imagem vem de `makeFile`, só chamada quando vai servir.
 */
export async function shareCard(
  text: string,
  makeFile: () => Promise<File>,
  env: ShareEnv,
): Promise<ShareOutcome> {
  const { nav } = env;
  if (typeof nav.share !== 'function') {
    env.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
    return 'whatsapp';
  }
  try {
    if (typeof nav.canShare === 'function') {
      const file = await makeFile();
      if (nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], text });
        return 'files';
      }
    }
    await nav.share({ text });
    return 'text';
  } catch (e) {
    if (isAbort(e)) return 'cancelled';
    throw e;
  }
}
