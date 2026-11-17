import {
  pushConfigSchema,
  pushSubscriptionInputSchema,
  pushTestResultSchema,
  type PushSubscriptionInput,
} from '@fut-stats/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { apiDeleteNoContent, apiGet, apiPost, apiPutNoContent } from '../../lib/api';
import { detectIos, readStandalone } from './device';
import { pushState, type PushPermission, type PushState } from './push-state';
import { urlBase64ToUint8Array } from './push-subscription';

/** Quanto esperar o service worker ficar pronto ao ligar (em dev ele não existe e o `ready` nunca responde). */
const READY_TIMEOUT_MS = 10_000;

const configKey = ['push', 'config'] as const;

function browserSupportsPush(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function readPermission(): PushPermission {
  return 'Notification' in window ? Notification.permission : 'default';
}

/** A assinatura deste aparelho, se houver. `getRegistration` responde na hora: antes do primeiro registro não há assinatura. */
async function readSubscription(): Promise<PushSubscription | null> {
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    return (await registration?.pushManager.getSubscription()) ?? null;
  } catch {
    return null;
  }
}

async function readyRegistration(): Promise<ServiceWorkerRegistration> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('service worker indisponível')), READY_TIMEOUT_MS);
  });
  return Promise.race([navigator.serviceWorker.ready, timeout]);
}

/** O que o navegador devolve, no formato do contrato (descarta `expirationTime`). */
function toInput(subscription: PushSubscription): PushSubscriptionInput {
  return pushSubscriptionInputSchema.parse(subscription.toJSON());
}

export type PushTestStatus = 'idle' | 'sending' | 'sent' | 'not-registered' | 'error';

export type UsePush = {
  state: PushState;
  permission: PushPermission;
  /** Ligando ou desligando. */
  busy: boolean;
  /** A última tentativa de ligar ou desligar falhou. */
  failed: 'enable' | 'disable' | null;
  testStatus: PushTestStatus;
  /** Chame só no toque da pessoa: é aqui que o navegador pergunta pela permissão. */
  enable: () => void;
  disable: () => void;
  sendTest: () => void;
};

/**
 * Avisos push deste aparelho: o que o navegador suporta, a permissão, a assinatura e o que o servidor diz
 * (`GET /push/config`). Nunca pede permissão sozinho. `sync` (só o Perfil): quem já tem assinatura no navegador a
 * reenvia ao abrir, para o servidor ligá-la a quem está logado agora (o aparelho pode ter trocado de conta).
 */
export function usePush({ sync = false }: { sync?: boolean } = {}): UsePush {
  const config = useQuery({
    queryKey: configKey,
    queryFn: ({ signal }) => apiGet('/push/config', pushConfigSchema, { signal }),
    staleTime: 5 * 60 * 1000,
  });
  const supported = browserSupportsPush();
  const [permission, setPermission] = useState<PushPermission>(readPermission);
  // `undefined`: o navegador ainda não respondeu
  const [subscription, setSubscription] = useState<PushSubscription | null | undefined>(undefined);
  const [failed, setFailed] = useState<UsePush['failed']>(null);
  const [testStatus, setTestStatus] = useState<PushTestStatus>('idle');

  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    void readSubscription().then((found) => {
      if (!cancelled) setSubscription(found);
    });
    return () => {
      cancelled = true;
    };
  }, [supported]);

  const synced =
    sync && subscription !== undefined && subscription !== null && permission === 'granted';
  useEffect(() => {
    if (!synced || !subscription || config.data?.enabled !== true) return;
    const parsed = pushSubscriptionInputSchema.safeParse(subscription.toJSON());
    if (parsed.success)
      void apiPutNoContent('/push/subscriptions', parsed.data).catch(() => undefined);
  }, [synced, subscription, config.data?.enabled]);

  const enableMutation = useMutation({
    mutationFn: async (publicKey: string) => {
      let result = Notification.permission;
      if (result === 'default') result = await Notification.requestPermission();
      setPermission(result);
      if (result !== 'granted') return null;
      const registration = await readyRegistration();
      const existing = await registration.pushManager.getSubscription();
      const created =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }));
      try {
        await apiPutNoContent('/push/subscriptions', toInput(created));
      } catch (error) {
        // Sem o registro no servidor a assinatura não serve: desfaz, para a próxima tentativa começar limpa
        if (!existing) await created.unsubscribe().catch(() => undefined);
        throw error;
      }
      return created;
    },
    onMutate: () => {
      setFailed(null);
      setTestStatus('idle');
    },
    onSuccess: (created) => {
      if (created) setSubscription(created);
    },
    onError: () => setFailed('enable'),
  });

  const disableMutation = useMutation({
    mutationFn: async (current: PushSubscription) => {
      await apiDeleteNoContent('/push/subscriptions', { endpoint: current.endpoint });
      await current.unsubscribe().catch(() => undefined);
    },
    onMutate: () => {
      setFailed(null);
      setTestStatus('idle');
    },
    onSuccess: () => setSubscription(null),
    onError: () => setFailed('disable'),
  });

  const testMutation = useMutation({
    mutationFn: () => apiPost('/push/test', pushTestResultSchema),
    onMutate: () => setTestStatus('sending'),
    onSuccess: ({ sent }) => setTestStatus(sent > 0 ? 'sent' : 'not-registered'),
    onError: () => setTestStatus('error'),
  });

  const state = pushState({
    serverEnabled: config.data?.enabled,
    ios: detectIos(),
    standalone: readStandalone(),
    supported,
    permission,
    subscribed: supported
      ? subscription === undefined
        ? undefined
        : subscription !== null
      : false,
  });

  const publicKey = config.data?.publicKey ?? null;
  return {
    state,
    permission,
    busy: enableMutation.isPending || disableMutation.isPending,
    failed,
    testStatus,
    enable: () => {
      if (publicKey) enableMutation.mutate(publicKey);
    },
    disable: () => {
      if (subscription) disableMutation.mutate(subscription);
    },
    sendTest: () => testMutation.mutate(),
  };
}
