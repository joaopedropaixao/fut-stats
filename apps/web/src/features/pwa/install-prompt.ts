/**
 * Guarda o `beforeinstallprompt` do navegador (Chrome e Edge disparam uma vez, logo depois de abrir). O
 * `main.tsx` chama `captureInstallPrompt` na partida, antes de qualquer tela: se o evento chegasse antes do
 * Feed ou do Perfil montarem, ele se perderia. Este arquivo não importa nada (cabe no pedaço inicial).
 */
export type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

let deferred: InstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function captureInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    // Sem isto o navegador mostra a faixa dele; aqui a pessoa instala pela tecla do card
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installed = true;
    emit();
  });
}

export function subscribeInstallPrompt(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const getInstallPrompt = (): InstallPromptEvent | null => deferred;
/** O navegador avisou `appinstalled` nesta visita. */
export const wasInstalled = (): boolean => installed;

/** Um pedido só vale uma vez: depois do `prompt()` o navegador solta outro evento quando quiser. */
export function takeInstallPrompt(): InstallPromptEvent | null {
  const event = deferred;
  deferred = null;
  emit();
  return event;
}
