import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PushTimeoutError, SUBSCRIBE_TIMEOUT_MS, withTimeout } from './push-timeout';

describe('withTimeout (assinar demorou, C39)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('o limite folga os 32 s já vistos num perfil novo do Chrome', () => {
    expect(SUBSCRIBE_TIMEOUT_MS).toBeGreaterThan(32_000);
  });

  it('devolve o valor quando termina dentro do prazo, sem chamar onLate', async () => {
    const onLate = vi.fn();
    const result = withTimeout(
      new Promise<string>((resolve) => setTimeout(() => resolve('ok'), 30_000)),
      60_000,
      onLate,
    );
    await vi.advanceTimersByTimeAsync(30_000);
    await expect(result).resolves.toBe('ok');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(onLate).not.toHaveBeenCalled();
  });

  it('estoura com PushTimeoutError passado o prazo', async () => {
    const result = withTimeout(new Promise<string>(() => {}), 1_000, vi.fn());
    const assertion = expect(result).rejects.toBeInstanceOf(PushTimeoutError);
    await vi.advanceTimersByTimeAsync(1_000);
    await assertion;
  });

  it('o erro de tempo traz nome e o prazo, para o log do console', async () => {
    const result = withTimeout(new Promise<string>(() => {}), 1_500, vi.fn());
    const assertion = expect(result).rejects.toMatchObject({
      name: 'PushTimeoutError',
      message: expect.stringContaining('1500'),
    });
    await vi.advanceTimersByTimeAsync(1_500);
    await assertion;
  });

  it('terminou depois do prazo: entrega o valor tardio a onLate (para desfazer a assinatura órfã)', async () => {
    const onLate = vi.fn();
    const result = withTimeout(
      new Promise<string>((resolve) => setTimeout(() => resolve('tarde'), 5_000)),
      1_000,
      onLate,
    );
    const assertion = expect(result).rejects.toBeInstanceOf(PushTimeoutError);
    await vi.advanceTimersByTimeAsync(1_000);
    await assertion;
    expect(onLate).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(4_000);
    expect(onLate).toHaveBeenCalledExactlyOnceWith('tarde');
  });

  it('falha dentro do prazo repassa o erro original', async () => {
    const boom = new Error('permissão negada');
    const result = withTimeout(Promise.reject(boom), 1_000, vi.fn());
    await expect(result).rejects.toBe(boom);
  });

  it('falha depois do prazo é descartada sem erro solto', async () => {
    const onLate = vi.fn();
    const result = withTimeout(
      new Promise<string>((_, reject) => setTimeout(() => reject(new Error('tarde')), 5_000)),
      1_000,
      onLate,
    );
    const assertion = expect(result).rejects.toBeInstanceOf(PushTimeoutError);
    await vi.advanceTimersByTimeAsync(5_000);
    await assertion;
    expect(onLate).not.toHaveBeenCalled();
  });
});
