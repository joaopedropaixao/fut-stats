import { afterEach, describe, expect, it, vi } from 'vitest';
import { getChannelMode, setChannelMode, subscribeChannelModes } from './channel-mode';

afterEach(() => {
  setChannelMode('r1', null);
  setChannelMode('r2', null);
});

describe('channel-mode: registro do modo do canal por rodada', () => {
  it('sem canal (ou sem rodada), vale o modo antigo', () => {
    expect(getChannelMode('r1')).toBe('polling');
    expect(getChannelMode(undefined)).toBe('polling');
  });

  it('cada rodada tem o seu modo', () => {
    setChannelMode('r1', 'live');
    expect(getChannelMode('r1')).toBe('live');
    expect(getChannelMode('r2')).toBe('polling');
  });

  it('fechar o canal (null) volta ao modo antigo', () => {
    setChannelMode('r1', 'live');
    setChannelMode('r1', null);
    expect(getChannelMode('r1')).toBe('polling');
  });
});

describe('channel-mode: aviso aos ouvintes', () => {
  it('só avisa quando o modo muda de verdade', () => {
    const listener = vi.fn();
    const off = subscribeChannelModes(listener);
    setChannelMode('r1', 'live');
    setChannelMode('r1', 'live');
    expect(listener).toHaveBeenCalledTimes(1);
    setChannelMode('r1', 'polling');
    expect(listener).toHaveBeenCalledTimes(2);
    off();
    setChannelMode('r1', 'live');
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
