import {
  channelMode,
  initialStreamState,
  onFailure,
  onReady,
  onRetry,
  retryDelay,
  type ChannelMode,
  type StreamState,
} from './stream-state';

/** O pedaço do `EventSource` que o canal usa (permite um falso nos testes). */
export type StreamSource = {
  addEventListener(type: string, listener: (event: MessageEvent<string>) => void): void;
  close(): void;
};

export type RoundStreamOptions<Scope> = {
  url: string;
  /** Lê a mensagem `changed`: os escopos, ou `null` se ela não bate com o contrato. */
  parse: (data: string) => readonly Scope[] | null;
  /** Os escopos que mudaram (mensagem lida). Com mensagem fora do contrato, `fallbackScopes`. */
  onChanged: (scopes: readonly Scope[]) => void;
  /** Tudo a refazer quando a mensagem vem estranha ou quando o canal (re)conecta (pode ter perdido aviso). */
  fallbackScopes: readonly Scope[];
  /** O modo do canal mudou (conectado ou modo antigo). */
  onMode: (mode: ChannelMode) => void;
  createSource?: (url: string) => StreamSource;
  now?: () => number;
};

/**
 * Mantém um canal ao vivo de uma rodada: abre o `EventSource`, lê as mensagens e, se a conexão cair, tenta de novo
 * sozinho (a cada 3 s; depois de 3 falhas seguidas em 1 min, fica 60 s no modo antigo). Nunca lança erro para a
 * tela: o canal é um extra, a tela segue certa com as consultas de sempre. Devolve a função que fecha tudo.
 */
export function connectRoundStream<Scope>(options: RoundStreamOptions<Scope>): () => void {
  const create = options.createSource ?? ((url: string) => new EventSource(url));
  const now = options.now ?? Date.now;
  let state: StreamState = initialStreamState;
  let source: StreamSource | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;

  const setState = (next: StreamState) => {
    state = next;
    options.onMode(channelMode(next));
  };

  const scheduleRetry = () => {
    const delay = retryDelay(state, now());
    if (delay === null) return;
    timer = setTimeout(() => {
      timer = null;
      state = onRetry(state, now());
      // O prazo do modo antigo ainda não acabou (relógio adiantado/atrasado): espera o resto
      if (state.phase === 'legacy') scheduleRetry();
      else open();
    }, delay);
  };

  const open = () => {
    if (closed) return;
    let current: StreamSource;
    try {
      current = create(options.url);
    } catch {
      setState(onFailure(state, now()));
      scheduleRetry();
      return;
    }
    source = current;
    // Eventos de uma conexão que já foi trocada não valem
    const live = () => !closed && source === current;
    current.addEventListener('ready', () => {
      if (!live()) return;
      setState(onReady(state, now()));
      options.onChanged(options.fallbackScopes);
    });
    current.addEventListener('changed', (event) => {
      if (!live()) return;
      options.onChanged(options.parse(event.data) ?? options.fallbackScopes);
    });
    current.addEventListener('error', () => {
      if (!live()) return;
      // Fecha a conexão do navegador e retoma pela nossa conta: a contagem de falhas e o modo antigo são nossos
      current.close();
      source = null;
      setState(onFailure(state, now()));
      scheduleRetry();
    });
  };

  options.onMode(channelMode(state));
  open();

  return () => {
    closed = true;
    if (timer !== null) clearTimeout(timer);
    source?.close();
    source = null;
  };
}
