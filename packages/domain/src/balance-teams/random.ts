/** Gerador de números aleatórios em [0, 1), como `Math.random`. */
export type RandomFn = () => number;

/** Aleatório com seed (mulberry32): mesma seed, mesma sequência. Útil em testes. */
export function seededRandom(seed: number): RandomFn {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
