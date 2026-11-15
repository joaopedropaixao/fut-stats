import type { TeamKey } from '../lineup/lineup-draft';

type RotationTurnKey = { team: TeamKey; index: number };

export function shouldWhistleOnTurnChange(
  previous: RotationTurnKey | null,
  current: RotationTurnKey | null,
  enabled: boolean,
): boolean {
  return Boolean(
    enabled &&
    previous &&
    current &&
    previous.team === current.team &&
    current.index > previous.index,
  );
}

/** Apito curto sem arquivo; o chamador libera áudio somente após gesto e preferência ativa. */
export function playRotationWhistle(context: AudioContext | null, enabled: boolean) {
  if (!enabled || !context) return;

  try {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const startAt = context.currentTime;
    const endAt = startAt + 0.25;

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(950, startAt);
    oscillator.frequency.exponentialRampToValueAtTime(1320, startAt + 0.07);
    oscillator.frequency.exponentialRampToValueAtTime(1080, startAt + 0.22);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(0.065, startAt + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.24);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startAt);
    oscillator.stop(endAt);
  } catch {
    // Áudio indisponível não pode interromper o rodízio.
  }
}
