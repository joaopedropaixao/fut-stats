import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  isMatchOpen,
  validateMatchEvent,
  validateMatchEventRemoval,
  validateRoundTransition,
  validateScoreEntry,
  type LineupSlot,
  type MatchScore,
  type RoundActor,
  type RoundState,
  type RoundTeams,
  type Team,
} from '@fut-stats/domain';
import {
  MATCH_EVENT_ERROR_LABELS,
  ROUND_TRANSITION_ERROR_LABELS,
  SCORE_ENTRY_ERROR_LABELS,
  type ChangeMatchStatusInput,
  type LaunchMatchEventInput,
  type MatchView,
  type SetMatchScoreInput,
} from '@fut-stats/shared';
import type { GroupMembership } from '../auth/request';
import { PrismaService } from '../prisma/prisma.service';

function toActor(membership: GroupMembership): RoundActor {
  return { id: membership.id, isAdmin: membership.role === 'ADMIN' };
}

/** Erro de regra: quem não pode (dono/admin) → 403; o resto (momento, placar, quem jogou) → 409. */
function ruleError(code: string, message: string, forbiddenCode?: string) {
  const body = { code, message };
  return code === forbiddenCode ? new ForbiddenException(body) : new ConflictException(body);
}

@Injectable()
export class MatchService {
  constructor(private readonly prisma: PrismaService) {}

  /** O jogo da rodada: placar, quem jogou, lances e o próximo passo do admin. */
  async view(membership: GroupMembership, roundId: string): Promise<MatchView> {
    const { state, ...data } = await this.load(membership.groupId, roundId);
    const actor = toActor(membership);
    const { status } = state;

    const target =
      status === 'TEAMS_PUBLISHED' ? 'IN_PROGRESS' : status === 'IN_PROGRESS' ? 'VOTING' : null;
    const [firstError] = target ? validateRoundTransition(state, target) : [];

    return {
      roundId,
      status,
      score: state.score ? { ...state.score } : null,
      players: data.players,
      events: data.events.map((event) => ({
        ...event,
        canRemove:
          validateMatchEventRemoval(
            { playerId: event.membershipId, type: event.type },
            actor,
            state,
          ).length === 0,
      })),
      me: { membershipId: membership.id, isAdmin: membership.role === 'ADMIN' },
      isOpen: isMatchOpen(status),
      next: target
        ? {
            to: target,
            allowed: !firstError,
            reason: firstError ? ROUND_TRANSITION_ERROR_LABELS[firstError] : null,
          }
        : null,
    };
  }

  /** Começar (TEAMS_PUBLISHED → IN_PROGRESS) ou encerrar o jogo (IN_PROGRESS → VOTING), como o domain permitir. */
  async changeStatus(
    membership: GroupMembership,
    roundId: string,
    { to }: ChangeMatchStatusInput,
  ): Promise<MatchView> {
    const { state } = await this.load(membership.groupId, roundId);
    const [error] = validateRoundTransition(state, to);
    if (error) throw ruleError(error, ROUND_TRANSITION_ERROR_LABELS[error]);

    await this.prisma.round.update({ where: { id: roundId }, data: { status: to } });
    return this.view(membership, roundId);
  }

  async setScore(
    membership: GroupMembership,
    roundId: string,
    input: SetMatchScoreInput,
  ): Promise<MatchView> {
    const { state } = await this.load(membership.groupId, roundId);
    const score: MatchScore = { WHITE: input.WHITE, BLACK: input.BLACK };
    const [error] = validateScoreEntry(score, toActor(membership), state);
    if (error) throw ruleError(error, SCORE_ENTRY_ERROR_LABELS[error], 'NOT_ADMIN');

    await this.prisma.round.update({
      where: { id: roundId },
      data: { whiteGoals: score.WHITE, blackGoals: score.BLACK },
    });
    return this.view(membership, roundId);
  }

  /** Gol ou assistência. `membershipId` de quem não jogou (ou de outro grupo) cai em `PLAYER_DID_NOT_PLAY`. */
  async launchEvent(
    membership: GroupMembership,
    roundId: string,
    input: LaunchMatchEventInput,
  ): Promise<MatchView> {
    const { state } = await this.load(membership.groupId, roundId);
    const [error] = validateMatchEvent(
      { playerId: input.membershipId, type: input.type },
      toActor(membership),
      state,
    );
    if (error) throw ruleError(error, MATCH_EVENT_ERROR_LABELS[error], 'NOT_OWN_EVENT');

    await this.prisma.matchEvent.create({
      data: {
        roundId,
        membershipId: input.membershipId,
        type: input.type,
        createdById: membership.id,
      },
    });
    return this.view(membership, roundId);
  }

  async removeEvent(
    membership: GroupMembership,
    roundId: string,
    eventId: string,
  ): Promise<MatchView> {
    const { state } = await this.load(membership.groupId, roundId);
    const event = await this.prisma.matchEvent.findFirst({
      where: { id: eventId, roundId },
      select: { id: true, membershipId: true, type: true },
    });
    if (!event) throw new NotFoundException();

    const [error] = validateMatchEventRemoval(
      { playerId: event.membershipId, type: event.type },
      toActor(membership),
      state,
    );
    if (error) throw ruleError(error, MATCH_EVENT_ERROR_LABELS[error], 'NOT_OWN_EVENT');

    await this.prisma.matchEvent.delete({ where: { id: event.id } });
    return this.view(membership, roundId);
  }

  /** A rodada do grupo da rota (senão 404) no formato do domain, mais o que a tela mostra. */
  private async load(groupId: string, roundId: string) {
    const round = await this.prisma.round.findFirst({
      where: { id: roundId, groupId },
      select: {
        status: true,
        whiteGoals: true,
        blackGoals: true,
        teamPlayers: {
          select: {
            membershipId: true,
            team: true,
            position: true,
            isReserve: true,
            membership: { select: { nickname: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        matchEvents: {
          select: {
            id: true,
            membershipId: true,
            type: true,
            createdById: true,
            createdAt: true,
            membership: { select: { nickname: true } },
            createdBy: { select: { nickname: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!round) throw new NotFoundException();

    const teams = toRoundTeams(round.teamPlayers);
    const state: RoundState = {
      status: round.status,
      teams,
      score:
        round.whiteGoals !== null && round.blackGoals !== null
          ? { WHITE: round.whiteGoals, BLACK: round.blackGoals }
          : null,
      events: round.matchEvents.map((e) => ({ playerId: e.membershipId, type: e.type })),
    };

    const teamOfPlayer = new Map<string, Team>(
      round.teamPlayers.map((p) => [p.membershipId, p.team]),
    );
    return {
      state,
      players: round.teamPlayers.map((p) => ({
        membershipId: p.membershipId,
        nickname: p.membership.nickname,
        team: p.team,
        position: p.position,
        isReserve: p.isReserve,
      })),
      events: round.matchEvents.map((e) => ({
        id: e.id,
        membershipId: e.membershipId,
        nickname: e.membership.nickname,
        team: teamOfPlayer.get(e.membershipId) ?? 'WHITE',
        type: e.type,
        createdById: e.createdById,
        createdByNickname: e.createdBy.nickname,
        createdAt: e.createdAt.toISOString(),
      })),
    };
  }
}

type TeamPlayerRow = {
  membershipId: string;
  team: Team;
  position: LineupSlot['position'];
  isReserve: boolean;
};

/** Escalação do banco no formato do domain; sem ninguém escalado = `null` (times não montados). */
function toRoundTeams(rows: TeamPlayerRow[]): RoundTeams | null {
  if (rows.length === 0) return null;
  const starters: Record<Team, LineupSlot[]> = { WHITE: [], BLACK: [] };
  const reserves: Record<Team, string[]> = { WHITE: [], BLACK: [] };
  for (const row of rows) {
    if (row.isReserve) reserves[row.team].push(row.membershipId);
    else starters[row.team].push({ playerId: row.membershipId, position: row.position });
  }
  return { ...starters, reserves };
}
