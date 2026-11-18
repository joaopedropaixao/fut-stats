import { describe, expect, it } from 'vitest';
import { pwaOptions } from '../pwa-options';

describe('opções do VitePWA: o SW e o manifesto existem também no `pnpm dev`', () => {
  // Regressão: sem devOptions o dev não registrava service worker nem servia o manifesto, e o interruptor de
  // avisos esperava `navigator.serviceWorker.ready` até o timeout ("Não deu para ativar agora")
  it('liga o service worker de dev', () => {
    expect(pwaOptions.devOptions?.enabled).toBe(true);
    expect(pwaOptions.devOptions?.type).toBe('classic');
  });

  it('o SW (build e dev) importa o push-sw.js e deixa /api/* fora do fallback', () => {
    expect(pwaOptions.workbox?.importScripts).toContain('push-sw.js');
    const denylist = pwaOptions.workbox?.navigateFallbackDenylist ?? [];
    expect(denylist.some((re) => re.test('/api/auth/google'))).toBe(true);
  });

  it('o manifesto instalável tem ícones 192 e 512', () => {
    const sizes = (pwaOptions.manifest ? (pwaOptions.manifest.icons ?? []) : []).map(
      (i) => i.sizes,
    );
    expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
  });
});
