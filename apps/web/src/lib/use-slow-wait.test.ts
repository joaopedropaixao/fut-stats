import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SLOW_WAIT_MS, useSlowWait } from './slow-wait';

/**
 * O web não tem DOM no Vitest (nem @testing-library). Para testar o hook de verdade, sem dependência nova, o
 * `react` é trocado por um mini executor de hooks: `useState` e `useEffect` com as regras que o hook usa (efeito só
 * roda quando as dependências mudam, a limpeza roda antes do próximo efeito e ao desmontar, `setState` re-renderiza).
 */
const h = vi.hoisted(() => {
  type Slot = { value?: unknown; deps?: unknown[]; cleanup?: (() => void) | void };
  const self = {
    slots: [] as Slot[],
    index: 0,
    effects: [] as Array<() => void>,
    dirty: false,
    rendering: false,
    render: () => {},
  };
  return self;
});

vi.mock('react', () => ({
  useState: (initial: unknown) => {
    const i = h.index++;
    h.slots[i] ??= { value: initial };
    const slot = h.slots[i]!;
    return [
      slot.value,
      (next: unknown) => {
        slot.value =
          typeof next === 'function' ? (next as (v: unknown) => unknown)(slot.value) : next;
        if (h.rendering) h.dirty = true;
        else h.render();
      },
    ];
  },
  useEffect: (fn: () => (() => void) | void, deps: unknown[]) => {
    const i = h.index++;
    const prev = h.slots[i];
    const changed = !prev || !prev.deps || deps.some((d, k) => d !== prev.deps![k]);
    if (!changed) return;
    h.effects.push(() => {
      prev?.cleanup?.();
      h.slots[i] = { deps, cleanup: fn() };
    });
  },
}));

// O mini executor chama o hook por um apelido: a regra de hooks do lint não vale fora de um componente
const hookUnderTest = useSlowWait;

function renderHook(initial: { active: boolean }) {
  let props = initial;
  const result = { current: false };
  h.slots = [];
  h.render = () => {
    do {
      h.dirty = false;
      h.rendering = true;
      h.index = 0;
      h.effects = [];
      result.current = hookUnderTest(props.active);
      for (const run of h.effects) run();
      h.rendering = false;
    } while (h.dirty);
  };
  h.render();
  return {
    result,
    rerender: (next: { active: boolean }) => {
      props = next;
      h.render();
    },
    unmount: () => {
      for (const slot of h.slots) slot?.cleanup?.();
    },
  };
}

describe('useSlowWait (aviso "Acordando o servidor")', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('aparece aos 5 s com active=true e não antes', () => {
    const hook = renderHook({ active: true });
    expect(hook.result.current).toBe(false);
    vi.advanceTimersByTime(SLOW_WAIT_MS - 1);
    expect(hook.result.current).toBe(false);
    vi.advanceTimersByTime(1);
    expect(hook.result.current).toBe(true);
  });

  it('parado (active=false) nunca aparece e não deixa temporizador', () => {
    const hook = renderHook({ active: false });
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(60_000);
    expect(hook.result.current).toBe(false);
  });

  it('some quando a espera termina (sucesso ou erro) e a próxima espera recomeça do zero', () => {
    const hook = renderHook({ active: true });
    vi.advanceTimersByTime(SLOW_WAIT_MS);
    expect(hook.result.current).toBe(true);

    hook.rerender({ active: false });
    expect(hook.result.current).toBe(false);
    expect(vi.getTimerCount()).toBe(0);

    hook.rerender({ active: true });
    expect(hook.result.current).toBe(false);
    vi.advanceTimersByTime(SLOW_WAIT_MS - 1);
    expect(hook.result.current).toBe(false);
    vi.advanceTimersByTime(1);
    expect(hook.result.current).toBe(true);
  });

  it('terminar antes dos 5 s cancela o aviso: a espera seguinte não herda o tempo da anterior', () => {
    const hook = renderHook({ active: true });
    vi.advanceTimersByTime(3000);
    hook.rerender({ active: false });
    hook.rerender({ active: true });
    vi.advanceTimersByTime(3000);
    expect(hook.result.current).toBe(false);
    vi.advanceTimersByTime(2000);
    expect(hook.result.current).toBe(true);
  });

  it('desmontar limpa o temporizador', () => {
    const hook = renderHook({ active: true });
    vi.advanceTimersByTime(1000);
    hook.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
