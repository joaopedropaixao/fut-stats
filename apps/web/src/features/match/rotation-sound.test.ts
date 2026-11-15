import { describe, expect, it, vi } from 'vitest';
import { playRotationWhistle, shouldWhistleOnTurnChange } from './rotation-sound';

function createAudioContextDouble() {
  const oscillator = {
    type: 'square',
    frequency: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
  const gain = {
    gain: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
  };
  const context = {
    currentTime: 12,
    destination: {},
    createOscillator: vi.fn(() => oscillator),
    createGain: vi.fn(() => gain),
  };
  return { context: context as unknown as AudioContext, oscillator, gain };
}

describe('playRotationWhistle', () => {
  it('emits a short sine whistle with a rising and falling pitch only when enabled', () => {
    const { context, oscillator, gain } = createAudioContextDouble();

    playRotationWhistle(context, true);

    expect(oscillator.type).toBe('sine');
    expect(oscillator.frequency.setValueAtTime).toHaveBeenCalledWith(950, 12);
    expect(oscillator.frequency.exponentialRampToValueAtTime).toHaveBeenNthCalledWith(
      1,
      1320,
      12.07,
    );
    expect(oscillator.frequency.exponentialRampToValueAtTime).toHaveBeenNthCalledWith(
      2,
      1080,
      12.22,
    );
    expect(gain.gain.exponentialRampToValueAtTime).toHaveBeenLastCalledWith(0.001, 12.24);
    expect(oscillator.start).toHaveBeenCalledWith(12);
    expect(oscillator.stop).toHaveBeenCalledWith(12.25);
  });

  it('stays silent while Som is disabled', () => {
    const { context } = createAudioContextDouble();

    playRotationWhistle(context, false);

    expect(context.createOscillator).not.toHaveBeenCalled();
    expect(context.createGain).not.toHaveBeenCalled();
  });

  it('stays silent before the user has created an audio context', () => {
    expect(() => playRotationWhistle(null, true)).not.toThrow();
  });
});

describe('shouldWhistleOnTurnChange', () => {
  it('apita uma vez quando muda o índice do turno do time selecionado', () => {
    expect(
      shouldWhistleOnTurnChange(
        { team: 'WHITE', index: 1 },
        { team: 'WHITE', index: 2 },
        {
          enabled: true,
          visible: true,
          syncingAfterBackground: false,
        },
      ),
    ).toBe(true);
  });

  it('não apita ao entrar em PREPARA/TROCA, na montagem ou ao alternar o seletor', () => {
    expect(
      shouldWhistleOnTurnChange(
        { team: 'WHITE', index: 1 },
        { team: 'WHITE', index: 1 },
        {
          enabled: true,
          visible: true,
          syncingAfterBackground: false,
        },
      ),
    ).toBe(false);
    expect(
      shouldWhistleOnTurnChange(
        null,
        { team: 'WHITE', index: 1 },
        {
          enabled: true,
          visible: true,
          syncingAfterBackground: false,
        },
      ),
    ).toBe(false);
    expect(
      shouldWhistleOnTurnChange(
        { team: 'WHITE', index: 1 },
        { team: 'BLACK', index: 2 },
        {
          enabled: true,
          visible: true,
          syncingAfterBackground: false,
        },
      ),
    ).toBe(false);
  });

  it('não apita quando Som está desligado, mesmo com virada de turno', () => {
    expect(
      shouldWhistleOnTurnChange(
        { team: 'WHITE', index: 1 },
        { team: 'WHITE', index: 2 },
        {
          enabled: false,
          visible: true,
          syncingAfterBackground: false,
        },
      ),
    ).toBe(false);
  });

  it('sincroniza a virada sem apitar enquanto está oculto ou ao voltar', () => {
    const previous = { team: 'WHITE', index: 1 } as const;
    const current = { team: 'WHITE', index: 2 } as const;

    expect(
      shouldWhistleOnTurnChange(previous, current, {
        enabled: true,
        visible: false,
        syncingAfterBackground: false,
      }),
    ).toBe(false);
    expect(
      shouldWhistleOnTurnChange(previous, current, {
        enabled: true,
        visible: true,
        syncingAfterBackground: true,
      }),
    ).toBe(false);
  });
});
