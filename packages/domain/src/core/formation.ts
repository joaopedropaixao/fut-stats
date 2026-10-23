import type { Position } from './position';

/** Formação 1-2-3-1: goleiro, 2 zagueiros, 2 alas, 1 meio, 1 atacante. */
export const FORMATION: Readonly<Record<Position, number>> = {
  GOALKEEPER: 1,
  DEFENDER: 2,
  WINGER: 2,
  MIDFIELDER: 1,
  FORWARD: 1,
};

export const PLAYERS_PER_TEAM = Object.values(FORMATION).reduce((sum, n) => sum + n, 0);

/** Máximo de reservas por time (entram no revezamento). */
export const MAX_RESERVES_PER_TEAM = 2;
