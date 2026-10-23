import { ROUND_TRANSITION_ERRORS, type LineupDraftError } from '@fut-stats/domain';
import { z } from 'zod';
import { positionSchema } from './domain';
import { attendanceMemberSchema } from './round';

/** Por que o rascunho dos times não pode ser salvo (`validateLineupDraft` no domain). */
export const LINEUP_DRAFT_ERROR_LABELS: Readonly<Record<LineupDraftError, string>> = {
  DUPLICATE_PLAYER: 'Tem jogador repetido nos times',
  POSITION_FULL: 'Tem posição com mais gente que o 1-2-3-1',
  TOO_MANY_RESERVES: 'Cada time tem no máximo 2 reservas',
};

/** Erros da API de times que não vêm do domain (dependem dos dados da rodada). */
export const LINEUP_NOT_EDITABLE_LABEL =
  'Só dá para mexer nos times com a rodada agendada: despublique antes';
export const PLAYER_NOT_CONFIRMED_LABEL = 'Só entra no time quem confirmou presença';

/** Um titular na vaga do 1-2-3-1: quem e em que posição. */
export const lineupSlotInputSchema = z.object({
  membershipId: z.string().min(1),
  position: positionSchema,
});

export const teamDraftInputSchema = z.object({
  starters: z.array(lineupSlotInputSchema),
  reserves: z.array(z.string().min(1)),
});

/** Corpo de PUT /api/groups/:groupId/rounds/:roundId/lineup: o rascunho inteiro, pode estar incompleto. */
export const saveLineupSchema = z.object({
  WHITE: teamDraftInputSchema,
  BLACK: teamDraftInputSchema,
});

/** Jogador escalado: o membro mais a posição em que joga (reserva fica na principal dele). */
export const lineupPlayerSchema = attendanceMemberSchema.extend({ position: positionSchema });

export const lineupTeamSchema = z.object({
  starters: z.array(lineupPlayerSchema),
  reserves: z.array(lineupPlayerSchema),
});

/**
 * Resposta de GET/PUT .../lineup. `published` = times publicados (visíveis a todos). Jogador comum antes
 * disso recebe times e `unassigned` vazios. `errors` = o que ainda falta para publicar (`validateRoundTeams`),
 * só para o admin.
 */
export const lineupSchema = z.object({
  published: z.boolean(),
  teams: z.object({ WHITE: lineupTeamSchema, BLACK: lineupTeamSchema }),
  unassigned: z.array(attendanceMemberSchema),
  errors: z.array(z.enum(ROUND_TRANSITION_ERRORS)),
});

export type SaveLineupInput = z.infer<typeof saveLineupSchema>;
export type LineupPlayer = z.infer<typeof lineupPlayerSchema>;
export type LineupTeam = z.infer<typeof lineupTeamSchema>;
export type Lineup = z.infer<typeof lineupSchema>;
