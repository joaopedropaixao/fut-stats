import type { Event, NodeOptions } from '@sentry/nestjs';

type Transport = ReturnType<NonNullable<NodeOptions['transport']>>;
type Envelope = Parameters<Transport['send']>[0];

/**
 * Transporte do Sentry que só grava: nenhum evento sai para a rede nos testes. Passe `recorder.transport` ao
 * `initMonitoring` e leia `recorder.events` depois de `await flushMonitoring()`.
 */
export class SentryRecorder {
  readonly events: Event[] = [];

  readonly transport: NonNullable<NodeOptions['transport']> = () => ({
    send: (envelope: Envelope) => {
      for (const [header, payload] of envelope[1]) {
        if (header.type === 'event') this.events.push(payload as Event);
      }
      return Promise.resolve({});
    },
    flush: () => Promise.resolve(true),
  });

  /** Eventos de erro (têm `exception`), sem as mensagens de aviso. */
  get errors(): Event[] {
    return this.events.filter((event) => event.exception);
  }

  /** As mensagens (`captureMessage`). */
  get messages(): Event[] {
    return this.events.filter((event) => event.message !== undefined);
  }

  reset(): void {
    this.events.length = 0;
  }
}
