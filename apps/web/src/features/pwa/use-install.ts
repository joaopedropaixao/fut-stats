import { useCallback, useSyncExternalStore } from 'react';
import { detectIos, readStandalone, subscribeStandalone } from './device';
import {
  getInstallPrompt,
  subscribeInstallPrompt,
  takeInstallPrompt,
  wasInstalled,
} from './install-prompt';
import { installMode, type InstallMode } from './install-state';

/**
 * Instalar o app: como (pedido do navegador, gaveta do iPhone ou nada) e a ação do pedido. Nunca pede nada
 * sozinho: o `install` só roda no toque da tecla.
 */
export function useInstall(): { mode: InstallMode; install: () => Promise<void> } {
  const prompt = useSyncExternalStore(subscribeInstallPrompt, getInstallPrompt, () => null);
  const installed = useSyncExternalStore(subscribeInstallPrompt, wasInstalled, () => false);
  const standalone = useSyncExternalStore(subscribeStandalone, readStandalone, () => false);

  const mode = installMode({
    standalone: standalone || installed,
    ios: detectIos(),
    hasPrompt: prompt !== null,
  });

  const install = useCallback(async () => {
    const event = takeInstallPrompt();
    if (!event) return;
    try {
      await event.prompt();
      await event.userChoice;
    } catch {
      // o navegador recusou abrir o pedido: a pessoa tenta de novo quando ele oferecer outro
    }
  }, []);

  return { mode, install };
}
