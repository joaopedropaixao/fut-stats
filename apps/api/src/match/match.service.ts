import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  isMatchOpen,
  isScoreOpen,
  matchResult,
  opponentOf,
  tallyMatchEvents,
  teamOf,
  validateMatchEvent,
  validateMatchEventRemoval,
  validateRoundTransition,
  validateScoreEntry,
  type MatchScore,
  type RoundActor,
  type RoundState,
  type RoundStatus,
  type RoundTeams,
  type Team,
} from '@fut-stats/domain';
import {
  MATCH_EVENT_ERROR_LABELS,
  ROUND_TRANSITION_ERROR_LABELS,
  SCORE_ENTRY_ERROR_LABELS,
  type LaunchMatchEventInput,
  type MatchView,
  type SetMatchScoreInput,
} from '@fut-stats/shared';
import type { GroupMembership } from '../auth/request';
import type { Position } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';

/** Erros de quem pode (dono do lance, admin) saem como 403; o resto (momento, números) como 409. */
const FORBIDDEN_CODES: ReadonlySet<string> = new Set(['NOT_ADMIN', 'NOT_OWN_EVENT']);

function ruleError(code: string, message: string) {
  const body = { code, message };
  return FORBIDDEN_CODES.has(code) ? new ForbiddenException(body) : new ConflictException(body);
}

/** Passos do admin (começar, finalizar, abrir a votação): quem não é admin leva 403 `NOT_ADMIN`, em qualquer etapa. */
function assertAdmin(membership: GroupMembership): void {
  if (membership.role !== 'ADMIN') {
    throw ruleError('NOT_ADMIN', SCORE_ENTRY_ERROR_LABELS.NOT_ADMIN);
  }
}

function toActor(membership: GroupMembership): RoundActor {
  return { id: membership.id, isAdmin: membership.role === 'ADMIN' };
}

function transitionError(code: keyof typeof ROUND_TRANSITION_ERROR_LABELS) {
  return ruleError(code, ROUND_TRANSITION_ERROR_LABELS[code]);
}

interface TeamPlayerRow {
  membershipId: string;
  team: Team;
  position: Position;
  isReserve: boolean;
}

/** Escalação do banco no formato do domain; sem ninguém escalado = `null` (times não montados). */
function toRoundTeams(rows: readonly TeamPlayerRow[]): RoundTeams | null {
  if (rows.length === 0) return null;
  const starters = (team: Team) =>
    rows
      .filter((row) => row.team === team && !row.isReserve)
      .map((row) => ({ playerId: row.membershipId, position: row.position }));
  const reserves = (team: Team) =>
    rows.filter((row) => row.team === team && row.isReserve).map((row) => row.membershipId);
  return {
    WHITE: starters('WHITE'),
    BLACK: starters('BLACK'),
    reserves: { WHITE: reserves('WHITE'), BLACK: reserves('BLACK') },
  };
}

@Injectable()
export class MatchService {
  constructor(private readonly prisma: PrismaService) {}

  /** O jogo da rodada: placar, quem jogou, lances, o que quem pede pode fazer e o que trava o próximo passo. */
  async view(membership: GroupMembership, roundId: string): Promise<MatchView> {
    const { state, ...data } = await this.load(membership.groupId, roundId);
    const actor = toActor(membership);
    const { status, teams } = state;

    const playerTeams = new Map<string, Team>(data.players.map((p) => [p.membershipId, p.team]));
    const events: MatchView['events'] = [];
    for (const event of data.events) {
      const playerTeam = playerTeams.get(event.membershipId);
      if (!playerTeam) continue;
      events.push({
        id: event.id,
        type: event.type,
        membershipId: event.membershipId,
        nickname: event.nickname,
        photoUrl: event.photoUrl,
        playerTeam,
        team: event.type === 'OWN_GOAL' ? opponentOf(playerTeam) : playerTeam,
        createdByNickname: event.createdByNickname,
        createdAt: event.createdAt.toISOString(),
        canRemove:
          validateMatchEventRemoval(
            { playerId: event.membershipId, type: event.type },
            actor,
            state,
          ).length === 0,
      });
    }

    const myTeam = teams ? teamOf(membership.id, teams) : null;
    const hasResult = status === 'POST_MATCH' || status === 'VOTING' || status === 'CLOSED';
    const result = hasResult && state.score && myTeam ? matchResult(state.score, myTeam) : null;

    const isAdmin = actor.isAdmin;
    const next: RoundStatus | null =
      status === 'TEAMS_PUBLISHED' ? 'IN_PROGRESS' : status === 'POST_MATCH' ? 'VOTING' : null;
    const errors = isAdmin && next ? validateRoundTransition(state, next) : [];

    // Sem placar, o limite de gols/assistências não entra na conta: só papel, momento e se jogou.
    const canLaunchOwn =
      myTeam !== null &&
      validateMatchEvent({ playerId: membership.id, type: 'GOAL' }, actor, {
        ...state,
        score: null,
      }).length === 0;

    return {
      roundId,
      number: data.number,
      scheduledAt: data.scheduledAt.toISOString(),
      status,
      score: state.score ? { ...state.score } : null,
      tally: teams
        ? tallyMatchEvents(state.events, teams)
        : { goals: { WHITE: 0, BLACK: 0 }, assists: { WHITE: 0, BLACK: 0 } },
      players: data.players,
      events,
      me: { membershipId: membership.id, isAdmin, team: myTeam, result },
      errors,
      permissions: {
        start: isAdmin && status === 'TEAMS_PUBLISHED',
        setScore: isAdmin && isScoreOpen(status),
        finish: isAdmin && status === 'IN_PROGRESS',
        openVoting: isAdmin && status === 'POST_MATCH',
        launchOwn: canLaunchOwn,
        launchAny: isAdmin && isMatchOpen(status),
      },
    };
  }

  /** TEAMS_PUBLISHED → IN_PROGRESS, só com times válidos e confirmados = escalados. */
  async start(membership: GroupMembership, roundId: string): Promise<MatchView> {
    assertAdmin(membership);
    const { state } = await this.load(membership.groupId, roundId);
    const [error] = validateRoundTransition(state, 'IN_PROGRESS');
    if (error) throw transitionError(error);

    await this.moveStatus(roundId, 'TEAMS_PUBLISHED', { status: 'IN_PROGRESS' });
    return this.view(membership, roundId);
  }

  async setScore(
    membership: GroupMembership,
    roundId: string,
    input: SetMatchScoreInput,
  ): Promise<MatchView> {
    // Quem não é admin leva NOT_ADMIN em qualquer etapa (o domain só o devolve com o placar aberto).
    assertAdmin(membership);
    const { state } = await this.load(membership.groupId, roundId);
    const score: MatchScore = { WHITE: input.WHITE, BLACK: input.BLACK };
    const actor = toActor(membership);
    const [error] = validateScoreEntry(score, actor, state);
    if (error) throw ruleError(error, SCORE_ENTRY_ERROR_LABELS[error]);

    await this.prisma.round.update({
      where: { id: roundId },
      data: { whiteGoals: score.WHITE, blackGoals: score.BLACK },
    });
    return this.view(membership, roundId);
  }

  /** IN_PROGRESS → POST_MATCH informando o placar final: valida o placar e a transição, e grava os dois juntos. */
  async finish(
    membership: GroupMembership,
    roundId: string,
    input: SetMatchScoreInput,
  ): Promise<MatchView> {
    assertAdmin(membership);
    const { state } = await this.load(membership.groupId, roundId);
    const score: MatchScore = { WHITE: input.WHITE, BLACK: input.BLACK };
    const withScore = { ...state, score };

    // A etapa errada vem primeiro: `finish` fora de IN_PROGRESS é transição inválida, não placar.
    const transition = validateRoundTransition(withScore, 'POST_MATCH');
    if (transition.includes('INVALID_TRANSITION')) throw transitionError('INVALID_TRANSITION');
    const [scoreError] = validateScoreEntry(score, toActor(membership), state);
    if (scoreError) throw ruleError(scoreError, SCORE_ENTRY_ERROR_LABELS[scoreError]);
    const [error] = transition;
    if (error) throw transitionError(error);

    await this.moveStatus(roundId, 'IN_PROGRESS', {
      status: 'POST_MATCH',
      whiteGoals: score.WHITE,
      blackGoals: score.BLACK,
    });
    return this.view(membership, roundId);
  }

  /** POST_MATCH → VOTING, com gols = placar. Grava quando a votação abriu; placar e lances congelam. */
  async openVoting(membership: GroupMembership, roundId: string): Promise<MatchView> {
    assertAdmin(membership);
    const { state } = await this.load(membership.groupId, roundId);
    const [error] = validateRoundTransition(state, 'VOTING');
    if (error) throw transitionError(error);

    await this.moveStatus(roundId, 'POST_MATCH', { status: 'VOTING', votingOpenedAt: new Date() });
    return this.view(membership, roundId);
  }

  /** Gol, assistência ou gol contra. Quem não jogou (ou é de outro grupo) cai em `PLAYER_DID_NOT_PLAY`. */
  async launchEvent(
    membership: GroupMembership,
    roundId: string,
    input: LaunchMatchEventInput,
  ): Promise<MatchView> {
    const { state } = await this.load(membership.groupId, roundId);
    const errors = validateMatchEvent(
      { playerId: input.membershipId, type: input.type },
      toActor(membership),
      state,
    );
    // Falta de permissão ganha de número: quem não pode lançar nem chega a saber do placar.
    const error = errors.find((code) => FORBIDDEN_CODES.has(code)) ?? errors[0];
    if (error) throw ruleError(error, MATCH_EVENT_ERROR_LABELS[error]);

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
    if (error) throw ruleError(error, MATCH_EVENT_ERROR_LABELS[error]);

    await this.prisma.matchEvent.delete({ where: { id: event.id } });
    return this.view(membership, roundId);
  }

  /** Muda a etapa só se ninguém mudou antes (dois admins ao mesmo tempo: o segundo leva 409). */
  private async moveStatus(
    roundId: string,
    from: RoundStatus,
    data: {
      status: RoundStatus;
      whiteGoals?: number;
      blackGoals?: number;
      votingOpenedAt?: Date;
    },
  ): Promise<void> {
    const { count } = await this.prisma.round.updateMany({
      where: { id: roundId, status: from },
      data,
    });
    if (count !== 1) throw transitionError('INVALID_TRANSITION');
  }

  /** A rodada do grupo da rota (senão 404) no formato do domain, mais o que a tela mostra. */
  private async load(groupId: string, roundId: string) {
    const round = await this.prisma.round.findFirst({
      where: { id: roundId, groupId },
      select: {
        number: true,
        scheduledAt: true,
        status: true,
        whiteGoals: true,
        blackGoals: true,
        teamPlayers: {
          select: {
            membershipId: true,
            team: true,
            position: true,
            isReserve: true,
            membership: { select: { nickname: true, photoUrl: true } },
          },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        },
        matchEvents: {
          select: {
            id: true,
            membershipId: true,
            type: true,
            createdAt: true,
            membership: { select: { nickname: true, photoUrl: true } },
            createdBy: { select: { nickname: true } },
          },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        },
      },
    });
    if (!round) throw new NotFoundException();

    // Quem confirmou presença e segue ativo: publicar e começar exigem que sejam os escalados.
    const confirmed = await this.prisma.membership.findMany({
      where: { groupId, active: true, attendances: { some: { roundId, confirmed: true } } },
      select: { id: true },
    });

    const state: RoundState = {
      status: round.status,
      teams: toRoundTeams(round.teamPlayers),
      confirmedIds: confirmed.map((m) => m.id),
      score:
        round.whiteGoals !== null && round.blackGoals !== null
          ? { WHITE: round.whiteGoals, BLACK: round.blackGoals }
          : null,
      events: round.matchEvents.map((e) => ({ playerId: e.membershipId, type: e.type })),
    };

    return {
      state,
      number: round.number,
      scheduledAt: round.scheduledAt,
      players: round.teamPlayers.map((p) => ({
        membershipId: p.membershipId,
        nickname: p.membership.nickname,
        photoUrl: p.membership.photoUrl,
        team: p.team,
        position: p.position,
        isReserve: p.isReserve,
      })),
      events: round.matchEvents.map((e) => ({
        id: e.id,
        type: e.type,
        membershipId: e.membershipId,
        nickname: e.membership.nickname,
        photoUrl: e.membership.photoUrl,
        createdByNickname: e.createdBy.nickname,
        createdAt: e.createdAt,
      })),
    };
  }
}
