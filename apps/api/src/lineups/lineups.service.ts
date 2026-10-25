import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  balanceTeams,
  canTransitionRound,
  POSITIONS,
  rankByRating,
  TEAMS,
  validateLineupDraft,
  validateRoundTransition,
  type PastRound,
  type Player,
  type RoundState,
  type RoundStatus,
  type RoundTeams,
  type Team,
} from '@fut-stats/domain';
import {
  BALANCE_TEAMS_ERROR_LABELS,
  LINEUP_DRAFT_ERROR_LABELS,
  LINEUP_NOT_EDITABLE_LABEL,
  PLAYER_NOT_CONFIRMED_LABEL,
  ROUND_TRANSITION_ERROR_LABELS,
  type AttendanceMember,
  type Lineup,
  type LineupPlayer,
  type LineupPermissions,
  type LineupSuggestion,
  type SaveLineupInput,
  type SuggestLineupInput,
} from '@fut-stats/shared';
import type { GroupMembership } from '../auth/request';
import { PrismaService } from '../prisma/prisma.service';

type Db = Pick<PrismaService, 'teamPlayer' | 'membership' | 'round'>;

/** Quantas rodadas já jogadas o seletor olha (cobre as janelas de repetição e de panelinha). */
const HISTORY_ROUNDS = 10;

const memberSelect = {
  id: true,
  nickname: true,
  photoUrl: true,
  primaryPosition: true,
  isHiredGoalkeeper: true,
  initialRating: true,
} as const;

interface MemberRow {
  id: string;
  nickname: string;
  photoUrl: string | null;
  primaryPosition: AttendanceMember['primaryPosition'];
  isHiredGoalkeeper: boolean;
  initialRating: number;
}

interface TeamPlayerRow {
  team: Team;
  position: LineupPlayer['position'];
  isReserve: boolean;
  membership: MemberRow;
}

/** Os TeamPlayer da rodada no formato que o domain valida. */
function toRoundTeams(rows: readonly TeamPlayerRow[]): RoundTeams {
  const starters = (team: Team) =>
    rows
      .filter((row) => row.team === team && !row.isReserve)
      .map((row) => ({ playerId: row.membership.id, position: row.position }));
  const reserves = (team: Team) =>
    rows.filter((row) => row.team === team && row.isReserve).map((row) => row.membership.id);
  return {
    WHITE: starters('WHITE'),
    BLACK: starters('BLACK'),
    reserves: { WHITE: reserves('WHITE'), BLACK: reserves('BLACK') },
  };
}

function toState(
  status: RoundStatus,
  rows: readonly TeamPlayerRow[],
  confirmedIds: readonly string[],
): RoundState {
  return { status, teams: toRoundTeams(rows), confirmedIds, score: null, events: [] };
}

@Injectable()
export class LineupsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Os times da rodada. O admin vê o rascunho; os outros só depois de publicar (`published` = a rodada já
   * saiu de SCHEDULED).
   */
  async get(membership: GroupMembership, roundId: string): Promise<Lineup> {
    const round = await this.findRound(membership.groupId, roundId);
    const isAdmin = membership.role === 'ADMIN';
    const published = round.status !== 'SCHEDULED';
    const visible = isAdmin || published;

    const rows = await this.teamPlayers(round.id);
    const confirmed = await this.confirmedMembers(this.prisma, membership.groupId, round.id);
    const confirmedIds = confirmed.map((m) => m.id);
    const state = toState(round.status, rows, confirmedIds);

    const emptyTeam = { starters: [], reserves: [] };
    if (!visible) {
      return {
        status: round.status,
        published,
        teams: { WHITE: emptyTeam, BLACK: emptyTeam },
        unassigned: [],
        errors: [],
        permissions: { edit: false, publish: false, unpublish: false },
      };
    }

    // Ranking entre ativos e escalados (um escalado que ficou inativo ainda aparece com posição).
    const placedIds = new Set(rows.map((row) => row.membership.id));
    const ranks = await this.ranks(this.prisma, membership.groupId, placedIds);
    const respondedAt = await this.respondedAt(round.id);
    const toMember = (m: MemberRow): AttendanceMember => ({
      membershipId: m.id,
      nickname: m.nickname,
      photoUrl: m.photoUrl,
      primaryPosition: m.primaryPosition,
      isHiredGoalkeeper: m.isHiredGoalkeeper,
      respondedAt: respondedAt.get(m.id) ?? null,
      rating: m.initialRating,
      rank: ranks.get(m.id)!,
    });
    const confirmedSet = new Set(confirmedIds);
    const player = (row: TeamPlayerRow): LineupPlayer => ({
      ...toMember(row.membership),
      position: row.position,
      confirmed: confirmedSet.has(row.membership.id),
    });
    const team = (key: Team) => ({
      starters: rows.filter((row) => row.team === key && !row.isReserve).map(player),
      reserves: rows.filter((row) => row.team === key && row.isReserve).map(player),
    });

    // Quem confirmou e segue ativo, em ordem de nome, fora dos times.
    const unassigned = confirmed.filter((m) => !placedIds.has(m.id)).map(toMember);

    const permissions: LineupPermissions = isAdmin
      ? {
          edit: round.status === 'SCHEDULED',
          publish: round.status === 'SCHEDULED',
          unpublish: canTransitionRound(state, 'SCHEDULED'),
        }
      : { edit: false, publish: false, unpublish: false };

    let errors: Lineup['errors'] = [];
    if (isAdmin && round.status === 'SCHEDULED') {
      errors = validateRoundTransition(state, 'TEAMS_PUBLISHED');
    } else if (isAdmin && round.status === 'TEAMS_PUBLISHED') {
      errors = validateRoundTransition(state, 'IN_PROGRESS');
    }

    return {
      status: round.status,
      published,
      teams: { WHITE: team('WHITE'), BLACK: team('BLACK') },
      unassigned,
      errors,
      permissions,
    };
  }

  /**
   * Sugere Branco x Preto com os confirmados ativos e o histórico das rodadas já jogadas do grupo. Só calcula:
   * nada é gravado (o admin salva pelo PUT). `avoid` = a divisão de agora, para o Regerar trazer outra.
   */
  async suggest(
    membership: GroupMembership,
    roundId: string,
    input: SuggestLineupInput,
  ): Promise<LineupSuggestion> {
    const round = await this.findRound(membership.groupId, roundId);
    if (round.status !== 'SCHEDULED') throw notEditable();

    const confirmed = await this.prisma.membership.findMany({
      where: {
        groupId: membership.groupId,
        active: true,
        attendances: { some: { roundId: round.id, confirmed: true } },
      },
      select: { id: true, primaryPosition: true, secondaryPositions: true, initialRating: true },
      orderBy: [{ nickname: 'asc' }, { createdAt: 'asc' }],
    });
    const players: Player[] = confirmed.map((m) => ({
      id: m.id,
      primaryPosition: m.primaryPosition,
      secondaryPositions: m.secondaryPositions,
      rating: m.initialRating,
    }));

    const history = await this.playedHistory(membership.groupId, round.scheduledAt);
    const avoid: PastRound | undefined = input.avoid && {
      WHITE: input.avoid.WHITE.starters.map((s) => ({
        playerId: s.membershipId,
        position: s.position,
      })),
      BLACK: input.avoid.BLACK.starters.map((s) => ({
        playerId: s.membershipId,
        position: s.position,
      })),
      reserves: { WHITE: input.avoid.WHITE.reserves, BLACK: input.avoid.BLACK.reserves },
    };

    const result = balanceTeams(players, history, {}, { avoid });
    if (!result.ok) {
      throw new ConflictException({
        code: result.error,
        message: BALANCE_TEAMS_ERROR_LABELS[result.error],
      });
    }

    const { round: teams } = result;
    const draft = (team: Team) => ({
      starters: teams[team].map((s) => ({ membershipId: s.playerId, position: s.position })),
      reserves: [...teams.reserves[team]],
    });
    return { teams: { WHITE: draft('WHITE'), BLACK: draft('BLACK') } };
  }

  /**
   * As rodadas do grupo já jogadas (em jogo, votação ou encerrada) marcadas antes de `before`, da mais antiga
   * para a mais recente, com os times e o placar. Rodada agendada ou com times só publicados não conta.
   */
  private async playedHistory(groupId: string, before: Date): Promise<PastRound[]> {
    const rounds = await this.prisma.round.findMany({
      where: {
        groupId,
        status: { in: ['IN_PROGRESS', 'VOTING', 'CLOSED'] },
        scheduledAt: { lt: before },
      },
      select: {
        whiteGoals: true,
        blackGoals: true,
        teamPlayers: {
          select: { membershipId: true, team: true, position: true, isReserve: true },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        },
      },
      orderBy: { scheduledAt: 'desc' },
      take: HISTORY_ROUNDS,
    });
    return rounds.reverse().map((r) => {
      const starters = (team: Team) =>
        r.teamPlayers
          .filter((row) => row.team === team && !row.isReserve)
          .map((row) => ({ playerId: row.membershipId, position: row.position }));
      const reserves = (team: Team) =>
        r.teamPlayers
          .filter((row) => row.team === team && row.isReserve)
          .map((row) => row.membershipId);
      return {
        WHITE: starters('WHITE'),
        BLACK: starters('BLACK'),
        reserves: { WHITE: reserves('WHITE'), BLACK: reserves('BLACK') },
        score:
          r.whiteGoals !== null && r.blackGoals !== null
            ? { WHITE: r.whiteGoals, BLACK: r.blackGoals }
            : null,
      };
    });
  }

  /** Troca o rascunho inteiro. Só com a rodada agendada, e só com quem confirmou presença. */
  async save(
    membership: GroupMembership,
    roundId: string,
    input: SaveLineupInput,
  ): Promise<Lineup> {
    const round = await this.findRound(membership.groupId, roundId);
    if (round.status !== 'SCHEDULED') throw notEditable();

    const draft: RoundTeams = {
      WHITE: input.WHITE.starters.map((s) => ({ playerId: s.membershipId, position: s.position })),
      BLACK: input.BLACK.starters.map((s) => ({ playerId: s.membershipId, position: s.position })),
      reserves: { WHITE: input.WHITE.reserves, BLACK: input.BLACK.reserves },
    };
    const [draftError] = validateLineupDraft(draft);
    if (draftError) {
      throw new BadRequestException({
        code: draftError,
        message: LINEUP_DRAFT_ERROR_LABELS[draftError],
      });
    }

    const ids = TEAMS.flatMap((t) => [
      ...input[t].starters.map((s) => s.membershipId),
      ...input[t].reserves,
    ]);
    // Quem já está no rascunho segue valendo mesmo que tenha desconfirmado depois: o admin tira ele quando quiser.
    const placed = (await this.teamPlayers(round.id)).map((row) => row.membership.id);
    const allowed = await this.prisma.membership.findMany({
      where: {
        id: { in: ids },
        groupId: membership.groupId,
        OR: [
          { active: true, attendances: { some: { roundId: round.id, confirmed: true } } },
          { id: { in: placed } },
        ],
      },
      select: { id: true, primaryPosition: true },
    });
    if (allowed.length !== ids.length) {
      throw new BadRequestException({
        code: 'PLAYER_NOT_CONFIRMED',
        message: PLAYER_NOT_CONFIRMED_LABEL,
      });
    }
    const primaryOf = new Map(allowed.map((m) => [m.id, m.primaryPosition]));

    const data = TEAMS.flatMap((team) => [
      ...input[team].starters.map((s) => ({
        roundId: round.id,
        team,
        membershipId: s.membershipId,
        position: s.position,
        isReserve: false,
      })),
      // Reserva não tem vaga fixa: guarda a posição principal dele.
      ...input[team].reserves.map((id) => ({
        roundId: round.id,
        team,
        membershipId: id,
        position: primaryOf.get(id)!,
        isReserve: true,
      })),
    ]);
    await this.prisma.$transaction(async (tx) => {
      // Trava a rodada e confere a etapa de novo: publicar ao mesmo tempo não deixa o rascunho mudar por baixo.
      const locked = await tx.round.updateMany({
        where: { id: round.id, status: 'SCHEDULED' },
        data: { status: 'SCHEDULED' },
      });
      if (locked.count !== 1) throw notEditable();
      await tx.teamPlayer.deleteMany({ where: { roundId: round.id } });
      await tx.teamPlayer.createMany({ data });
    });
    return this.get(membership, round.id);
  }

  /** SCHEDULED → TEAMS_PUBLISHED, só com a escalação válida e confirmados = escalados. */
  publish(membership: GroupMembership, roundId: string): Promise<Lineup> {
    return this.transition(membership, roundId, 'TEAMS_PUBLISHED');
  }

  /** TEAMS_PUBLISHED → SCHEDULED: o domain permite voltar para refazer os times. O rascunho fica. */
  unpublish(membership: GroupMembership, roundId: string): Promise<Lineup> {
    return this.transition(membership, roundId, 'SCHEDULED');
  }

  private async transition(
    membership: GroupMembership,
    roundId: string,
    to: RoundStatus,
  ): Promise<Lineup> {
    const round = await this.findRound(membership.groupId, roundId);
    await this.prisma.$transaction(async (tx) => {
      // Muda a etapa primeiro (trava a linha e só passa se ninguém mexeu) e valida com os dados lidos depois.
      const { count } = await tx.round.updateMany({
        where: { id: round.id, status: round.status },
        data: { status: to },
      });
      const rows = await this.teamPlayers(round.id, tx);
      const confirmed = await this.confirmedMembers(tx, membership.groupId, round.id);
      const [error] =
        count === 1
          ? validateRoundTransition(
              toState(
                round.status,
                rows,
                confirmed.map((m) => m.id),
              ),
              to,
            )
          : (['INVALID_TRANSITION'] as const);
      if (error) {
        throw new ConflictException({ code: error, message: ROUND_TRANSITION_ERROR_LABELS[error] });
      }
    });
    return this.get(membership, round.id);
  }

  private async teamPlayers(roundId: string, db: Db = this.prisma): Promise<TeamPlayerRow[]> {
    const rows = await db.teamPlayer.findMany({
      where: { roundId },
      select: { team: true, position: true, isReserve: true, membership: { select: memberSelect } },
      // O id (cuid) cresce na ordem em que o createMany os gerou: mantém a ordem salva dos reservas.
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    // Titulares na ordem do 1-2-3-1 (goleiro, zagueiros, alas, meio, atacante); reservas na ordem salva.
    const rank = (row: TeamPlayerRow) =>
      row.isReserve ? POSITIONS.length : POSITIONS.indexOf(row.position);
    return rows.sort((a, b) => rank(a) - rank(b));
  }

  /** Quem confirmou presença nesta rodada e segue ativo no grupo. */
  private confirmedMembers(db: Db, groupId: string, roundId: string): Promise<MemberRow[]> {
    return db.membership.findMany({
      where: { groupId, active: true, attendances: { some: { roundId, confirmed: true } } },
      select: memberSelect,
      orderBy: [{ nickname: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /** Posição de cada membro ativo (e dos escalados) no ranking do grupo pela nota. */
  private async ranks(db: Db, groupId: string, extraIds: ReadonlySet<string>) {
    const members = await db.membership.findMany({
      where: { groupId, OR: [{ active: true }, { id: { in: [...extraIds] } }] },
      select: { id: true, initialRating: true },
    });
    return rankByRating(members.map((m) => ({ id: m.id, rating: m.initialRating })));
  }

  private async respondedAt(roundId: string): Promise<Map<string, string>> {
    const rows = await this.prisma.attendance.findMany({
      where: { roundId },
      select: { membershipId: true, updatedAt: true },
    });
    return new Map(rows.map((row) => [row.membershipId, row.updatedAt.toISOString()]));
  }

  /** A rodada, só se for do grupo da rota; senão 404. */
  private async findRound(groupId: string, roundId: string) {
    const round = await this.prisma.round.findFirst({
      where: { id: roundId, groupId },
      select: { id: true, status: true, scheduledAt: true },
    });
    if (!round) throw new NotFoundException();
    return round;
  }
}

function notEditable(): ConflictException {
  return new ConflictException({ code: 'LINEUP_NOT_EDITABLE', message: LINEUP_NOT_EDITABLE_LABEL });
}
