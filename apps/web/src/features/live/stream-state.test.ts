import { describe, expect, it } from 'vitest';
import {
  channelMode,
  FAILURE_WINDOW_MS,
  initialStreamState,
  LEGACY_MS,
  onFailure,
  onReady,
  onRetry,
  RECONNECT_MS,
  retryDelay,
  STABLE_MS,
  type StreamState,
} from './stream-state';

const failTimes = (times: number[], from: StreamState = initialStreamState) =>
  times.reduce<StreamState>((state, at) => onFailure(state, at), from);

describe('stream-state: máquina do canal ao vivo', () => {
  it('começa conectando e pergunta de tempos em tempos (modo antigo) até chegar o ready', () => {
    expect(initialStreamState.phase).toBe('connecting');
    expect(channelMode(initialStreamState)).toBe('polling');
  });

  it('o ready conecta: tempo real', () => {
    const state = onReady(initialStreamState, 0);
    expect(state.phase).toBe('connected');
    expect(channelMode(state)).toBe('live');
    expect(retryDelay(state, 0)).toBeNull();
  });

  it('uma ou duas falhas seguem tentando a cada 3 s, ainda no modo antigo', () => {
    const one = failTimes([0]);
    expect(one.phase).toBe('connecting');
    expect(retryDelay(one, 0)).toBe(RECONNECT_MS);
    const two = failTimes([0, 3_000]);
    expect(two.phase).toBe('connecting');
    expect(channelMode(two)).toBe('polling');
  });

  it('3 falhas seguidas em 1 min: modo antigo por 60 s', () => {
    const state = failTimes([0, 3_000, 6_000]);
    expect(state).toEqual({ phase: 'legacy', until: 6_000 + LEGACY_MS });
    expect(channelMode(state)).toBe('polling');
    expect(retryDelay(state, 6_000)).toBe(LEGACY_MS);
    expect(retryDelay(state, 36_000)).toBe(30_000);
  });

  it('falhas espalhadas por mais de 1 min não somam', () => {
    const state = failTimes([0, 30_000, FAILURE_WINDOW_MS + 5_000]);
    // a primeira saiu da janela: só 2 contam
    expect(state.phase).toBe('connecting');
    expect(state).toEqual({ phase: 'connecting', failures: [30_000, FAILURE_WINDOW_MS + 5_000] });
  });

  it('a falha exatamente no limite da janela já não conta como seguida', () => {
    const state = failTimes([0, 10_000, FAILURE_WINDOW_MS]);
    expect(state.phase).toBe('connecting');
  });

  it('conexão que ficou de pé por STABLE_MS zera a contagem: falhas de antes não somam com as de depois', () => {
    const afterTwo = failTimes([0, 3_000]);
    const reconnected = onReady(afterTwo, 6_000);
    const fail = onFailure(reconnected, 6_000 + STABLE_MS);
    expect(fail).toEqual({ phase: 'connecting', failures: [6_000 + STABLE_MS] });
    expect(failTimes([6_000 + STABLE_MS + 3_000], fail).phase).toBe('connecting');
  });

  it('conexão que abre e cai logo não zera a contagem: o laço de reconexão vai para o modo antigo', () => {
    // abre (ready) e cai 1 s depois, três vezes seguidas, a cada 3 s
    let state: StreamState = initialStreamState;
    for (const at of [0, 4_000, 8_000]) {
      state = onReady(state, at);
      state = onFailure(state, at + 1_000);
    }
    expect(state).toEqual({ phase: 'legacy', until: 9_000 + LEGACY_MS });
  });

  it('o canal caiu depois de conectado por muito tempo: conta uma falha só', () => {
    const state = onFailure(onReady(initialStreamState, 0), STABLE_MS + 5_000);
    expect(state).toEqual({ phase: 'connecting', failures: [STABLE_MS + 5_000] });
    expect(channelMode(state)).toBe('polling');
  });

  it('falha no meio do modo antigo não muda nada', () => {
    const legacy = failTimes([0, 1_000, 2_000]);
    expect(onFailure(legacy, 10_000)).toBe(legacy);
  });

  it('passado o prazo, tenta de novo com a contagem zerada', () => {
    const legacy = failTimes([0, 1_000, 2_000]);
    expect(onRetry(legacy, 2_000 + LEGACY_MS - 1)).toBe(legacy);
    expect(onRetry(legacy, 2_000 + LEGACY_MS)).toEqual(initialStreamState);
    // e as 3 falhas seguintes levam de novo ao modo antigo
    const again = failTimes([62_000, 65_000, 68_000], onRetry(legacy, 62_000));
    expect(again).toEqual({ phase: 'legacy', until: 68_000 + LEGACY_MS });
  });

  it('onRetry fora do modo antigo não mexe no estado', () => {
    const connecting = failTimes([0]);
    expect(onRetry(connecting, 10_000)).toBe(connecting);
    const connected = onReady(initialStreamState, 0);
    expect(onRetry(connected, 10_000)).toBe(connected);
  });
});
