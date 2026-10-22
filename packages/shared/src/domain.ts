import { isValidRating, POSITIONS, RATING_MAX, RATING_MIN, TEAMS } from '@fut-stats/domain';
import type { BallotError, Position, RatingError, Team } from '@fut-stats/domain';
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

// Mensagens dos códigos de erro de validação do domínio. O Record obriga a ter texto para
// todo código: código novo no domain sem mensagem aqui não compila.

/** Por que uma nota é inválida. */
export const RATING_ERROR_LABELS: Readonly<Record<RatingError, string>> = {
  NOT_A_NUMBER: 'A nota precisa ser um número',
  OUT_OF_RANGE: 'A nota deve ir de 0 a 10',
  INVALID_STEP: 'A nota deve ser de 0,5 em 0,5',
};

/** Por que um voto (nota, MVP ou Bola Murcha) não é permitido. */
export const BALLOT_ERROR_LABELS: Readonly<Record<BallotError, string>> = {
  VOTER_DID_NOT_PLAY: 'Só quem jogou a rodada pode votar',
  TARGET_DID_NOT_PLAY: 'Só dá para votar em quem jogou a rodada',
  SELF_VOTE: 'Você não pode votar em si mesmo',
  SAME_PLAYER_BOTH: 'MVP e Bola Murcha precisam ser jogadores diferentes',
  DUPLICATE_VOTER: 'Você já votou nesta rodada',
};
