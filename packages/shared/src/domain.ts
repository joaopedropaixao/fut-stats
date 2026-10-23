import {
  isValidRating,
  MATCH_EVENT_TYPES,
  POSITIONS,
  RATING_MAX,
  RATING_MIN,
  ROUND_STATUSES,
  TEAMS,
  validateScore,
} from '@fut-stats/domain';
import type {
  Award,
  BallotError,
  CartolaScoutError,
  CartolaSquadError,
  MatchEventError,
  MatchEventType,
  Position,
  RatingError,
  RatingSheetError,
  RoundStatus,
  RoundTransitionError,
  ScoreEntryError,
  Team,
} from '@fut-stats/domain';
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

export const roundStatusSchema = z.enum(ROUND_STATUSES);
export const matchEventTypeSchema = z.enum(MATCH_EVENT_TYPES);

/** Placar da rodada: gols inteiros, zero ou mais. */
export const matchScoreSchema = z
  .object({ WHITE: z.number(), BLACK: z.number() })
  .refine((score) => validateScore(score) === null, {
    message: 'O placar precisa ser um número inteiro, zero ou mais',
  });

export const lineupSlotSchema = z.object({
  playerId: z.string().min(1),
  position: positionSchema,
});

/** Textos de UI para as posições. */
export const POSITION_LABELS: Readonly<Record<Position, string>> = {
  GOALKEEPER: 'Goleiro',
  DEFENDER: 'Zagueiro',
  WINGER: 'Ala',
  MIDFIELDER: 'Meia',
  FORWARD: 'Atacante',
};

/** Textos de UI para os times. */
export const TEAM_LABELS: Readonly<Record<Team, string>> = {
  WHITE: 'Branco',
  BLACK: 'Preto',
};

/** Textos de UI para os prêmios da rodada. */
export const AWARD_LABELS: Readonly<Record<Award, string>> = {
  MVP: 'Craque',
  FLOP: 'Perna de Pau',
};

/** Textos de UI para as etapas da rodada. */
export const ROUND_STATUS_LABELS: Readonly<Record<RoundStatus, string>> = {
  SCHEDULED: 'Agendada',
  TEAMS_PUBLISHED: 'Times publicados',
  IN_PROGRESS: 'Em jogo',
  VOTING: 'Votação',
  CLOSED: 'Encerrada',
};

/** Textos de UI para os tipos de lance. */
export const MATCH_EVENT_TYPE_LABELS: Readonly<Record<MatchEventType, string>> = {
  GOAL: 'Gol',
  ASSIST: 'Assistência',
  OWN_GOAL: 'Gol contra',
};

// Mensagens dos códigos de erro de validação do domínio. O Record obriga a ter texto para
// todo código: código novo no domain sem mensagem aqui não compila.

/** Por que uma nota é inválida. */
export const RATING_ERROR_LABELS: Readonly<Record<RatingError, string>> = {
  NOT_A_NUMBER: 'A nota precisa ser um número',
  OUT_OF_RANGE: 'A nota deve ir de 0 a 10',
  INVALID_STEP: 'A nota deve ser de 0,5 em 0,5',
};

/** Por que um voto (nota, Craque ou Perna de Pau) não é permitido. */
export const BALLOT_ERROR_LABELS: Readonly<Record<BallotError, string>> = {
  VOTER_DID_NOT_PLAY: 'Só quem jogou a rodada pode votar',
  TARGET_DID_NOT_PLAY: 'Só dá para votar em quem jogou a rodada',
  SELF_VOTE: 'Você não pode votar em si mesmo',
  SAME_PLAYER_BOTH: 'Craque e Perna de Pau precisam ser jogadores diferentes',
  DUPLICATE_VOTER: 'Você já votou nesta rodada',
};

/** Por que a folha de notas de um votante é inválida. */
export const RATING_SHEET_ERROR_LABELS: Readonly<Record<RatingSheetError, string>> = {
  VOTER_DID_NOT_PLAY: BALLOT_ERROR_LABELS.VOTER_DID_NOT_PLAY,
  TARGET_DID_NOT_PLAY: BALLOT_ERROR_LABELS.TARGET_DID_NOT_PLAY,
  SELF_VOTE: BALLOT_ERROR_LABELS.SELF_VOTE,
  ...RATING_ERROR_LABELS,
  MISSING_RATING: 'Dê nota a todos que jogaram',
  DUPLICATE_TARGET: 'Só uma nota por jogador',
};

/** Por que um scout do Cartola é inválido. */
export const CARTOLA_SCOUT_ERROR_LABELS: Readonly<Record<CartolaScoutError, string>> = {
  INVALID_COUNT: 'Use um número inteiro, zero ou mais',
};

/** Por que uma escalação do Cartola é inválida. */
export const CARTOLA_SQUAD_ERROR_LABELS: Readonly<Record<CartolaSquadError, string>> = {
  INVALID_FORMATION:
    'A escalação precisa ser 1-2-3-1: goleiro, 2 zagueiros, 2 alas, 1 meio e 1 atacante',
  UNKNOWN_PLAYER: 'Tem jogador na escalação que não está no mercado',
  POSITION_NOT_ALLOWED: 'Tem jogador numa posição que não é a principal nem a secundária dele',
  OVER_BUDGET: 'A escalação passa do seu patrimônio',
  CAPTAIN_NOT_IN_SQUAD: 'O capitão precisa estar na escalação',
};

/** Por que a rodada não pode mudar de etapa. */
export const ROUND_TRANSITION_ERROR_LABELS: Readonly<Record<RoundTransitionError, string>> = {
  INVALID_TRANSITION: 'A rodada não pode ir para essa etapa agora',
  INVALID_LINEUP: 'Os dois times precisam estar completos no 1-2-3-1, sem jogador nos dois',
  INVALID_RESERVES: 'Tem reserva demais, repetido ou que já é titular',
  SCORE_MISSING: 'Lance o placar antes',
  INVALID_SCORE: 'O placar precisa ser um número inteiro, zero ou mais',
  GOALS_MISMATCH: 'Os gols lançados precisam bater com o placar',
  TOO_MANY_ASSISTS: 'Tem time com mais assistências que gols',
};

/** Por que um lance (gol, assistência, gol contra) não pode ser lançado ou apagado. */
export const MATCH_EVENT_ERROR_LABELS: Readonly<Record<MatchEventError, string>> = {
  ROUND_NOT_OPEN: 'Só dá para lançar durante o jogo ou a votação',
  NOT_OWN_EVENT: 'Você só pode lançar os seus próprios lances',
  PLAYER_DID_NOT_PLAY: 'Esse jogador não jogou a rodada',
  GOALS_EXCEED_SCORE: 'Esse gol passa do placar do time',
  ASSISTS_EXCEED_SCORE: 'Essa assistência passa dos gols do time no placar',
};

/** Por que o placar não pode ser lançado. */
export const SCORE_ENTRY_ERROR_LABELS: Readonly<Record<ScoreEntryError, string>> = {
  ROUND_NOT_OPEN: 'Só dá para lançar o placar durante o jogo ou a votação',
  NOT_ADMIN: 'Só o admin lança o placar',
  INVALID_SCORE: 'O placar precisa ser um número inteiro, zero ou mais',
  SCORE_BELOW_GOALS: 'O placar não pode ser menor que os gols já lançados',
  SCORE_BELOW_ASSISTS: 'O placar não pode ser menor que as assistências já lançadas',
};
