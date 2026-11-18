import { describe, expect, it } from 'vitest';
import { dismiss, DISMISS_DAYS, isDismissed } from './dismissal';

const DAY = 24 * 60 * 60 * 1000;
const T0 = Date.UTC(2026, 10, 17);

function fakeStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

describe('dispensar as linhas do Feed por 14 dias (C25, C33)', () => {
  it('sem dispensa, a linha aparece', () => {
    expect(isDismissed('install', T0, fakeStorage())).toBe(false);
  });

  it('dispensada, some pelos 14 dias e volta no 14º', () => {
    const storage = fakeStorage();
    dismiss('install', T0, storage);
    expect(isDismissed('install', T0 + 1000, storage)).toBe(true);
    expect(isDismissed('install', T0 + (DISMISS_DAYS - 1) * DAY, storage)).toBe(true);
    expect(isDismissed('install', T0 + DISMISS_DAYS * DAY, storage)).toBe(false);
  });

  it('cada linha tem a sua dispensa', () => {
    const storage = fakeStorage();
    dismiss('install', T0, storage);
    expect(isDismissed('push', T0, storage)).toBe(false);
  });

  it('valor estragado no armazenamento conta como "não dispensei"', () => {
    const storage = { getItem: () => 'talvez', setItem: () => undefined };
    expect(isDismissed('push', T0, storage)).toBe(false);
  });

  it('armazenamento bloqueado não quebra nada', () => {
    const blocked = {
      getItem: () => {
        throw new DOMException('bloqueado', 'SecurityError');
      },
      setItem: () => {
        throw new DOMException('bloqueado', 'SecurityError');
      },
    };
    expect(isDismissed('push', T0, blocked)).toBe(false);
    expect(() => dismiss('push', T0, blocked)).not.toThrow();
  });
});
