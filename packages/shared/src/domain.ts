import { isValidRating, POSITIONS, RATING_MAX, RATING_MIN, TEAMS } from '@fut-stats/domain';
import type { Position, Team } from '@fut-stats/domain';
import { z } from 'zod';

// Schemas derivados das constantes do domínio: a regra mora em packages/domain,
// aqui só vira validação para API e web.

export const positionSchema = z.enum(POSITIONS);
export const teamSchema = z.enum(TEAMS);

export const ratingSchema = z
  .number()
  .min(RATING_MIN)
  .max(RATING_MAX)
  .refine(isValidRating, { message: 'A nota deve ir de 0 a 10, de 0,5 em 0,5' });

export const lineupSlotSchema = z.object({
  playerId: z.string().min(1),
  position: positionSchema,
});

/** Textos de UI para as posições. */
export const POSITION_LABELS: Readonly<Record<Position, string>> = {
  GOALKEEPER: 'Goleiro',
  DEFENDER: 'Zagueiro',
  WINGER: 'Ala',
  MIDFIELDER: 'Meio-campo',
  FORWARD: 'Atacante',
};

/** Textos de UI para os times. */
export const TEAM_LABELS: Readonly<Record<Team, string>> = {
  WHITE: 'Branco',
  BLACK: 'Preto',
};
