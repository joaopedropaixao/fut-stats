/**
 * Máquina de estado do canal ao vivo de uma rodada (pura, sem timer nem rede). Quem a move é `round-stream.ts`.
 * O canal nunca é requisito para a tela estar certa: sem ele, as consultas voltam a perguntar de tempos em tempos.
 */

/** Quantas falhas seguidas, dentro da janela, mandam o app para o modo antigo. */
export const FAILURES_TO_GIVE_UP = 3;
/** Janela em que as falhas contam como "seguidas" (ms). */
export const FAILURE_WINDOW_MS = 60_000;
/** Quanto tempo o app fica no modo antigo antes de tentar o canal de novo (ms). */
export const LEGACY_MS = 60_000;
/** Espera entre uma tentativa de conexão e a seguinte (o mesmo `retry` que a API manda) (ms). */
export const RECONNECT_MS = 3_000;
/**
 * Quanto tempo a conexão precisa ficar de pé para as falhas anteriores deixarem de contar (ms). Sem isso, uma
 * conexão que abre e cai logo reconectaria a cada 3 s para sempre, refazendo tudo a cada vez.
 */
export const STABLE_MS = 30_000;
/** Com o canal conectado, a consulta só confere de vez em quando, como rede de segurança (ms). */
export const SAFETY_REFRESH_MS = 60_000;

/** `live` = o canal está conectado; `polling` = pergunta de tempos em tempos, como antes do canal. */
export type ChannelMode = 'live' | 'polling';

export type StreamState =
  | { phase: 'connecting'; failures: readonly number[] }
  | { phase: 'connected'; since: number; failures: readonly number[] }
  | { phase: 'legacy'; until: number };

export const initialStreamState: StreamState = { phase: 'connecting', failures: [] };

/**
 * A API mandou `ready`: a conexão vale. As falhas anteriores ficam guardadas até a conexão ficar de pé por
 * `STABLE_MS` (conferido na próxima falha).
 */
export function onReady(state: StreamState, now: number): StreamState {
  const failures = state.phase === 'legacy' ? [] : state.failures;
  return { phase: 'connected', since: now, failures };
}

/** A conexão falhou ou caiu. A terceira falha seguida na janela leva ao modo antigo por `LEGACY_MS`. */
export function onFailure(state: StreamState, now: number): StreamState {
  if (state.phase === 'legacy') return state;
  // Conexão que ficou de pé por `STABLE_MS` zera a conta; a que caiu logo depois do `ready` segue somando
  const carried =
    state.phase === 'connected' && now - state.since >= STABLE_MS ? [] : state.failures;
  const recent = carried.filter((t) => now - t < FAILURE_WINDOW_MS);
  const failures = [...recent, now];
  if (failures.length >= FAILURES_TO_GIVE_UP) return { phase: 'legacy', until: now + LEGACY_MS };
  return { phase: 'connecting', failures };
}

/** Chegou a hora de tentar de novo: o modo antigo termina quando o prazo passa. */
export function onRetry(state: StreamState, now: number): StreamState {
  if (state.phase === 'legacy' && now >= state.until) return initialStreamState;
  return state;
}

/** Em quantos ms tentar conectar de novo; `null` com o canal conectado (nada a tentar). */
export function retryDelay(state: StreamState, now: number): number | null {
  if (state.phase === 'connected') return null;
  if (state.phase === 'legacy') return Math.max(0, state.until - now);
  return RECONNECT_MS;
}

/** Só conectado vale o tempo real: conectando ou no modo antigo, as consultas seguem os intervalos de antes. */
export function channelMode(state: StreamState): ChannelMode {
  return state.phase === 'connected' ? 'live' : 'polling';
}
