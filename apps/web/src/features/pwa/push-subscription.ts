/** A chave pública VAPID (base64url, de `GET /push/config`) no formato que o `pushManager.subscribe` pede. */
export function urlBase64ToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const raw = atob((base64Url + padding).replaceAll('-', '+').replaceAll('_', '/'));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/**
 * A assinatura do navegador foi feita com esta chave pública? Uma assinatura de chave VAPID velha (o servidor trocou a
 * chave) nunca mais recebe aviso: o serviço de push recusa o envio. Sem a chave na assinatura, não dá para reaproveitar.
 */
export function sameServerKey(
  subscriptionKey: ArrayBuffer | null | undefined,
  publicKey: string,
): boolean {
  if (!subscriptionKey) return false;
  const current = urlBase64ToUint8Array(publicKey);
  const stored = new Uint8Array(subscriptionKey);
  if (stored.length !== current.length) return false;
  return stored.every((byte, i) => byte === current[i]);
}

type PushManagerLike = Pick<PushManager, 'getSubscription' | 'subscribe'>;

/**
 * A assinatura deste aparelho com a chave atual: reaproveita a do navegador se ela é da mesma chave; se é de outra,
 * desfaz e assina de novo. Só com a permissão já concedida. `fresh` diz se a assinatura foi criada agora.
 */
export async function subscribeWithKey(
  pushManager: PushManagerLike,
  publicKey: string,
): Promise<{ subscription: PushSubscription; fresh: boolean }> {
  const existing = await pushManager.getSubscription();
  if (existing && sameServerKey(existing.options.applicationServerKey, publicKey))
    return { subscription: existing, fresh: false };
  if (existing) await existing.unsubscribe().catch(() => false);
  const subscription = await pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });
  return { subscription, fresh: true };
}
