import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SLOW_WAIT_MS, startSlowWait } from './slow-wait';

describe('temporizador do aviso "Acordando o servidor"', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('avisa só quando a espera chega a 5 s', () => {
    const onSlow = vi.fn();
    startSlowWait(onSlow);
    vi.advanceTimersByTime(SLOW_WAIT_MS - 1);
    expect(onSlow).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onSlow).toHaveBeenCalledTimes(1);
  });

  it('a espera de 5 s é o combinado no spec', () => {
    expect(SLOW_WAIT_MS).toBe(5000);
  });

  it('cancelar antes dos 5 s (terminou ou desmontou) nunca avisa e não deixa temporizador vivo', () => {
    const onSlow = vi.fn();
    const cancel = startSlowWait(onSlow);
    vi.advanceTimersByTime(3000);
    cancel();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(60_000);
    expect(onSlow).not.toHaveBeenCalled();
  });

  it('cancelar depois de avisar é inofensivo', () => {
    const onSlow = vi.fn();
    const cancel = startSlowWait(onSlow);
    vi.advanceTimersByTime(SLOW_WAIT_MS);
    cancel();
    expect(onSlow).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
