import { useCallback, useSyncExternalStore } from 'react';

/** Fundo do app: "Gramado" (verde, padrão) ou "Noite" (escuro, opção nas configurações). */
export type Background = 'gramado' | 'noite';

const STORAGE_KEY = 'fut-stats:fundo';
const listeners = new Set<() => void>();
let current: Background | undefined;

function read(): Background {
  if (current) return current;
  try {
    current = localStorage.getItem(STORAGE_KEY) === 'noite' ? 'noite' : 'gramado';
  } catch {
    current = 'gramado';
  }
  return current;
}

/** Aplica o fundo salvo no <html> (data-theme="night"). Chamar antes do primeiro render, para não piscar. */
export function applyBackground(value: Background = read()) {
  const root = document.documentElement;
  if (value === 'noite') root.dataset.theme = 'night';
  else delete root.dataset.theme;
  // A barra do navegador acompanha o fundo
  const bg = getComputedStyle(root).getPropertyValue('--color-bg').trim();
  if (bg) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
}

/** Preferência é do aparelho (não vai para a API): fica no localStorage. */
export function useBackground() {
  const value = useSyncExternalStore((cb) => {
    listeners.add(cb);
    return () => listeners.delete(cb);
  }, read);

  const set = useCallback((next: Background) => {
    current = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Sem localStorage (aba anônima restrita): vale só nesta sessão
    }
    applyBackground(next);
    listeners.forEach((cb) => cb());
  }, []);

  return [value, set] as const;
}
