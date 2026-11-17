import { apiDeleteNoContent } from '../../lib/api';

/**
 * Sair da conta desliga os avisos deste aparelho: cancela a assinatura no servidor e no navegador, para quem
 * entrar depois neste celular não receber o aviso de outra pessoa. Nunca lança nem trava o logout: sem
 * assinatura (ou sem service worker) não faz nada, e uma falha de rede deixa a limpeza para o servidor, que
 * apaga a assinatura quando o serviço de push disser que ela não existe mais.
 */
export async function unsubscribeDevice(): Promise<void> {
  try {
    if (!('serviceWorker' in navigator)) return;
    // `getRegistration` responde na hora (o `ready` esperaria o service worker ativar)
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager?.getSubscription();
    if (!subscription) return;
    await apiDeleteNoContent('/push/subscriptions', { endpoint: subscription.endpoint }).catch(
      () => undefined,
    );
    await subscription.unsubscribe();
  } catch {
    // o logout segue
  }
}
