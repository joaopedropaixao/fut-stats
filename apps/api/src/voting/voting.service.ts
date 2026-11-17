import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  compareNicknames,
  isVotingOpen,
  matchWinner,
  POSITIONS,
  rankByRating,
  roundResults,
  TEAMS,
  validateRoundTransition,
  validateRoundVote,
  votingCloseReason,
  votingDeadline,
  type RoundState,
  type RoundTeams,
  type RoundVote,
  type RoundVoteIssue,
  type Team,
  type VotingEndReason,
  type VotingState,
} from '@fut-stats/domain';
import {
  BALLOT_ERROR_LABELS,
  RATING_SHEET_ERROR_LABELS,
  ROUND_TRANSITION_ERROR_LABELS,
  SCORE_ENTRY_ERROR_LABELS,
  VOTING_ERROR_LABELS,
  type ResultPlayer,
  type RoundResult,
  type SubmitVoteInput,
  type VotingError,
  type VotingPlayer,
  type VotingView,
} from '@fut-stats/shared';
import { AuditService } from '../audit/audit.service';
import type { GroupMembership } from '../auth/request';
import { AVATAR_SELECT, toAvatar } from '../common/avatar';
import type { Position } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { RoundLockService, type RoundTx } from '../rounds/round-lock.service';

/** Quem pode (admin, quem jogou) sai como 403; o momento (votação fechada ou fora do ar), como 409. */
const FORBIDDEN_CODES: ReadonlySet<string> = new Set(['NOT_ADMIN', 'VOTER_DID_NOT_PLAY']);

function ruleError(code: string, message: string) {
  const body = { code, message };
  return FORBIDDEN_CODES.has(code) ? new ForbiddenException(body) : new ConflictException(body);
}

function votingError(code: VotingError) {
  return ruleError(code, VOTING_ERROR_LABELS[code]);
}

function transitionError(code: keyof typeof ROUND_TRANSITION_ERROR_LABELS) {
  return ruleError(code, ROUND_TRANSITION_ERROR_LABELS[code]);
}

/** O que a votação carrega de uma rodada (do grupo da rota; senão 404). */
const ROUND_SELECT = {
  id: true,
  groupId: true,
  number: true,
  scheduledAt: true,
  status: true,
  whiteGoals: true,
  blackGoals: true,
  votingOpenedAt: true,
  closedAt: true,
  votingEndReason: true,
  group: { select: { votingDeadlineHours: true } },
  teamPlayers: {
    select: {
      membershipId: true,
      team: true,
      position: true,
      isReserve: true,
      roundScore: true,
      ratingsCount: true,
      isMvp: true,
      isFlop: true,
      membership: { select: { nickname: true, active: true, ...AVATAR_SELECT } },
    },
  },
  matchEvents: { select: { membershipId: true, type: true } },
  votes: { select: { voterId: true } },
} as const;

type LoadedRound = NonNullable<Awaited<ReturnType<VotingService['findRound']>>>;

/** O que a regra de fechamento precisa: "todos votaram" conta só quem jogou e segue ativo. */
function votingStateOf(round: {
  scheduledAt: Date;
  votingOpenedAt: Date | null;
  group: { votingDeadlineHours: number };
  teamPlayers: readonly { membershipId: string; membership: { active: boolean } }[];
  votes: readonly { voterId: string }[];
}): VotingState {
  return {
    // `votingOpenedAt` é gravado ao abrir; o horário do jogo só cobre dado antigo, sem a coluna.
    openedAt: round.votingOpenedAt ?? round.scheduledAt,
    deadlineHours: round.group.votingDeadlineHours,
    playedIds: round.teamPlayers.filter((p) => p.membership.active).map((p) => p.membershipId),
    votedIds: round.votes.map((v) => v.voterId),
  };
}

function toRoundTeams(rows: LoadedRound['teamPlayers']): RoundTeams | null {
  if (rows.length === 0) return null;
  const starters = (team: Team) =>
    rows
      .filter((row) => row.team === team && !row.isReserve)
      .map((row) => ({ playerId: row.membershipId, position: row.position as Position }));
  const reserves = (team: Team) =>
    rows.filter((row) => row.team === team && row.isReserve).map((row) => row.membershipId);
  return {
    WHITE: starters('WHITE'),
    BLACK: starters('BLACK'),
    reserves: { WHITE: reserves('WHITE'), BLACK: reserves('BLACK') },
  };
}

function toVotingPlayer(row: LoadedRound['teamPlayers'][number]): VotingPlayer {
  return {
    membershipId: row.membershipId,
    nickname: row.membership.nickname,
    avatar: toAvatar(row.membership),
    team: row.team,
    position: row.position,
    isReserve: row.isReserve,
  };
}

/** Do meu time primeiro; em cada time, titulares pela vaga (goleiro ao atacante) e depois reservas. */
function orderPlayers(rows: LoadedRound['teamPlayers'], myTeam: Team | null) {
  const teamRank = (team: Team) => (team === myTeam ? -1 : TEAMS.indexOf(team));
  return [...rows].sort(
    (a, b) =>
      teamRank(a.team) - teamRank(b.team) ||
      Number(a.isReserve) - Number(b.isReserve) ||
      POSITIONS.indexOf(a.position) - POSITIONS.indexOf(b.position) ||
      compareNicknames(a.membership.nickname, b.membership.nickname),
  );
}

/** Por que o pacote de votos não passa: o primeiro problema dá o `code`; todos vão em `issues`. */
function invalidVote(issues: RoundVoteIssue[]) {
  const list = issues.map((issue) =>
    issue.kind === 'RATING'
      ? {
          path: `ratings.${issue.targetId}`,
          code: issue.code,
          message: RATING_SHEET_ERROR_LABELS[issue.code],
        }
      : { path: issue.field, code: issue.code, message: BALLOT_ERROR_LABELS[issue.code] },
  );
  const [first] = list;
  return new BadRequestException({ code: first!.code, message: first!.message, issues: list });
}

@Injectable()
export class VotingService {
  private readonly logger = new Logger(VotingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly roundLock: RoundLockService,
    private readonly audit: AuditService,
  ) {}

  /** A votação da rodada: quem jogou, quantos votaram, o meu voto e o que posso fazer. Nunca traz voto de outra pessoa. */
  async view(membership: GroupMembership, roundId: string, now = new Date()): Promise<VotingView> {
    // Prazo vencido e ninguém fechou ainda: quem abre o app fecha (a API gratuita dorme).
    await this.closeDueVotings(now, membership.groupId);
    return this.buildView(membership, roundId, now);
  }

  /**
   * Envia (ou troca) o pacote de votos: notas de todos + Craque + Perna de Pau. Só com a votação aberta e quem jogou.
   * Voto depois do prazo é recusado e a rodada fecha ali mesmo; o último voto fecha a rodada na mesma transação.
   */
  async submitVote(
    membership: GroupMembership,
    roundId: string,
    input: SubmitVoteInput,
    now = new Date(),
  ): Promise<VotingView> {
    const outcome = await this.roundLock.withRoundLock(membership.groupId, roundId, async (tx) => {
      const round = await this.requireRound(tx, membership.groupId, roundId);
      if (round.status === 'CLOSED') throw votingError('VOTING_CLOSED');
      if (round.status !== 'VOTING') throw votingError('VOTING_NOT_OPEN');

      // O prazo vale pela hora, não por quem acordou o servidor: fecha agora e recusa o voto.
      const due = votingCloseReason(now, votingStateOf(round));
      if (due) {
        await this.closeRound(tx, round, due, now, null);
        return 'CLOSED' as const;
      }

      const playedIds = round.teamPlayers.map((p) => p.membershipId);
      if (!playedIds.includes(membership.id)) {
        throw ruleError('VOTER_DID_NOT_PLAY', BALLOT_ERROR_LABELS.VOTER_DID_NOT_PLAY);
      }

      const vote: RoundVote = { voterId: membership.id, ...input };
      const { ratings, awards } = validateRoundVote(vote, playedIds);
      if (ratings.length > 0 || awards.length > 0) {
        throw invalidVote([
          ...ratings.map(
            (i) => ({ voterId: membership.id, kind: 'RATING', ...i }) satisfies RoundVoteIssue,
          ),
          ...awards.map(
            ({ field, code }) =>
              ({ voterId: membership.id, kind: 'AWARD', field, code }) satisfies RoundVoteIssue,
          ),
        ]);
      }

      // Trocar o pacote: as notas antigas saem e as novas entram, tudo ou nada.
      const ratingRows = input.ratings.map(({ targetId, value }) => ({ targetId, value }));
      await tx.vote.upsert({
        where: { roundId_voterId: { roundId, voterId: membership.id } },
        create: {
          roundId,
          voterId: membership.id,
          mvpId: input.mvpId,
          flopId: input.flopId,
          ratings: { create: ratingRows },
        },
        update: {
          mvpId: input.mvpId,
          flopId: input.flopId,
          updatedAt: now,
          ratings: { deleteMany: {}, create: ratingRows },
        },
      });

      // O último a votar fecha na hora.
      const after = await this.requireRound(tx, membership.groupId, roundId);
      const reason = votingCloseReason(now, votingStateOf(after));
      // Quem votou por último não aparece: o voto é anônimo, o fechamento não tem ator.
      if (reason) await this.closeRound(tx, after, reason, now, null);
      return 'VOTED' as const;
    });

    if (outcome === 'CLOSED') throw votingError('VOTING_CLOSED');
    return this.buildView(membership, roundId, now);
  }

  /** O admin encerra antes do prazo: os votos enviados até agora valem. Fecha e grava a apuração. */
  async close(membership: GroupMembership, roundId: string, now = new Date()): Promise<VotingView> {
    if (membership.role !== 'ADMIN') {
      throw ruleError('NOT_ADMIN', SCORE_ENTRY_ERROR_LABELS.NOT_ADMIN);
    }
    await this.roundLock.withRoundLock(membership.groupId, roundId, async (tx) => {
      const round = await this.requireRound(tx, membership.groupId, roundId);
      if (round.status !== 'VOTING') throw transitionError('INVALID_TRANSITION');
      // Se já era hora de fechar (prazo ou todo mundo votou), o motivo verdadeiro é esse, não o admin.
      const reason = votingCloseReason(now, votingStateOf(round)) ?? 'ADMIN_CLOSED';
      await this.closeRound(tx, round, reason, now, membership.id);
    });
    return this.buildView(membership, roundId, now);
  }

  /** O resultado gravado ao fechar. Antes disso, 409 `RESULT_NOT_READY`. */
  async result(
    membership: GroupMembership,
    roundId: string,
    now = new Date(),
  ): Promise<RoundResult> {
    await this.closeDueVotings(now, membership.groupId);
    const round = await this.requireRound(this.prisma, membership.groupId, roundId);
    if (
      round.status !== 'CLOSED' ||
      !round.closedAt ||
      !round.votingEndReason ||
      round.whiteGoals === null ||
      round.blackGoals === null
    ) {
      throw votingError('RESULT_NOT_READY');
    }

    const tally = new Map<string, { goals: number; assists: number; ownGoals: number }>();
    for (const { membershipId, type } of round.matchEvents) {
      const entry = tally.get(membershipId) ?? { goals: 0, assists: 0, ownGoals: 0 };
      if (type === 'GOAL') entry.goals += 1;
      else if (type === 'ASSIST') entry.assists += 1;
      else entry.ownGoals += 1;
      tally.set(membershipId, entry);
    }

    const ranks = rankByRating(
      round.teamPlayers
        .filter((p) => p.roundScore !== null)
        .map((p) => ({ id: p.membershipId, rating: p.roundScore! })),
    );
    const players: ResultPlayer[] = round.teamPlayers
      .map((row) => ({
        ...toVotingPlayer(row),
        score: row.roundScore,
        ratingsCount: row.ratingsCount,
        rank: ranks.get(row.membershipId) ?? null,
        goals: tally.get(row.membershipId)?.goals ?? 0,
        assists: tally.get(row.membershipId)?.assists ?? 0,
        ownGoals: tally.get(row.membershipId)?.ownGoals ?? 0,
        isMvp: row.isMvp,
        isFlop: row.isFlop,
      }))
      .sort(
        (a, b) =>
          Number(a.score === null) - Number(b.score === null) ||
          (b.score ?? 0) - (a.score ?? 0) ||
          compareNicknames(a.nickname, b.nickname),
      );

    const score = { WHITE: round.whiteGoals, BLACK: round.blackGoals };
    return {
      roundId: round.id,
      number: round.number,
      scheduledAt: round.scheduledAt.toISOString(),
      score,
      winner: matchWinner(score),
      closedAt: round.closedAt.toISOString(),
      closeReason: round.votingEndReason,
      // Quem jogou x quem mandou o pacote, como foi: não muda se alguém for desativado depois.
      votes: { voted: round.votes.length, total: round.teamPlayers.length },
      mvps: players.filter((p) => p.isMvp),
      flops: players.filter((p) => p.isFlop),
      players,
      me: {
        membershipId: membership.id,
        played: round.teamPlayers.some((p) => p.membershipId === membership.id),
      },
    };
  }

  /**
   * Fecha as votações com o prazo vencido (ou com todos os ativos já votados): o relógio da API, quem abre o
   * app depois do prazo e, em produção, o despertador chamam este mesmo método. Sem `groupId`, varre todos os
   * grupos (sem sessão). Cada rodada fecha na própria trava e transação; uma que falhe não impede as outras.
   * Devolve quantas fechou.
   */
  async closeDueVotings(now = new Date(), groupId?: string): Promise<number> {
    const rounds = await this.prisma.round.findMany({
      where: { status: 'VOTING', ...(groupId ? { groupId } : {}) },
      select: {
        id: true,
        groupId: true,
        scheduledAt: true,
        votingOpenedAt: true,
        group: { select: { votingDeadlineHours: true } },
        teamPlayers: { select: { membershipId: true, membership: { select: { active: true } } } },
        votes: { select: { voterId: true } },
      },
    });

    let closed = 0;
    for (const candidate of rounds) {
      if (!votingCloseReason(now, votingStateOf(candidate))) continue;
      try {
        const done = await this.roundLock.withRoundLock(
          candidate.groupId,
          candidate.id,
          async (tx) => {
            // Já pode ter fechado (último voto, admin) enquanto esperava a trava: confere de novo.
            const round = await this.requireRound(tx, candidate.groupId, candidate.id);
            if (round.status !== 'VOTING') return false;
            const reason = votingCloseReason(now, votingStateOf(round));
            if (!reason) return false;
            await this.closeRound(tx, round, reason, now, null);
            return true;
          },
        );
        if (done) closed += 1;
      } catch (error) {
        this.logger.error(
          `Não consegui fechar a votação da rodada ${candidate.id}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
    return closed;
  }

  /**
   * Fecha a votação (dentro da trava e do `tx` de quem chamou): confere o ciclo, apura as notas e os prêmios,
   * grava o resultado em cada `TeamPlayer` e leva a rodada a `CLOSED`. Depois disso o resultado não muda mais.
   * Grava também a linha `VOTING_CLOSED` do registro da rodada: `actorId` é o admin que pediu (`POST .../voting/close`,
   * qualquer que seja o motivo real) e `null` nos outros caminhos (último voto, prazo, relógio).
   */
  private async closeRound(
    tx: RoundTx,
    round: LoadedRound,
    reason: VotingEndReason,
    now: Date,
    actorId: string | null,
  ): Promise<void> {
    const state: RoundState = {
      status: round.status,
      teams: toRoundTeams(round.teamPlayers),
      confirmedIds: [],
      score:
        round.whiteGoals !== null && round.blackGoals !== null
          ? { WHITE: round.whiteGoals, BLACK: round.blackGoals }
          : null,
      events: round.matchEvents.map((e) => ({ playerId: e.membershipId, type: e.type })),
    };
    const [error] = validateRoundTransition(state, 'CLOSED');
    if (error) throw transitionError(error);

    const votes = await tx.vote.findMany({
      where: { roundId: round.id },
      select: {
        voterId: true,
        mvpId: true,
        flopId: true,
        ratings: { select: { targetId: true, value: true } },
      },
    });
    const playedIds = round.teamPlayers.map((p) => p.membershipId);
    const results = roundResults(votes, playedIds);
    if (!results.ok) {
      // Todo voto foi validado ao entrar: chegar aqui é dado corrompido, não erro de quem pede.
      throw new Error(
        `Votos inválidos na rodada ${round.id}: ${JSON.stringify(results.errors.slice(0, 5))}`,
      );
    }

    for (const id of playedIds) {
      const player = results.value.players[id]!;
      await tx.teamPlayer.update({
        where: { roundId_membershipId: { roundId: round.id, membershipId: id } },
        data: {
          roundScore: player.score,
          ratingsCount: player.ratingsCount,
          isMvp: results.value.mvpIds.includes(id),
          isFlop: results.value.flopIds.includes(id),
        },
      });
    }

    // Só fecha se ninguém fechou antes (a trava já garante; a condição protege de outro caminho de escrita).
    const { count } = await tx.round.updateMany({
      where: { id: round.id, status: 'VOTING' },
      data: { status: 'CLOSED', closedAt: now, votingEndReason: reason },
    });
    if (count !== 1) throw transitionError('INVALID_TRANSITION');

    await this.audit.record(tx, {
      groupId: round.groupId,
      roundId: round.id,
      actorId,
      action: 'VOTING_CLOSED',
      before: { status: 'VOTING' },
      // Só contagem: quem votou e o que votou não entram no registro.
      after: { status: 'CLOSED', reason, voted: votes.length, total: playedIds.length },
    });
  }

  private async buildView(
    membership: GroupMembership,
    roundId: string,
    now: Date,
  ): Promise<VotingView> {
    const round = await this.requireRound(this.prisma, membership.groupId, roundId);
    const isAdmin = membership.role === 'ADMIN';
    const me = round.teamPlayers.find((p) => p.membershipId === membership.id) ?? null;
    const state = votingStateOf(round);

    const myVote = me
      ? await this.prisma.vote.findUnique({
          where: { roundId_voterId: { roundId, voterId: membership.id } },
          select: {
            mvpId: true,
            flopId: true,
            updatedAt: true,
            ratings: { select: { targetId: true, value: true } },
          },
        })
      : null;

    const ordered = orderPlayers(round.teamPlayers, me?.team ?? null);
    const players = ordered.map(toVotingPlayer);
    const voted = new Set(state.votedIds);
    const active = ordered.filter((p) => p.membership.active);
    const open = isVotingOpen(round.status, now, state);

    let vote: VotingView['me']['vote'] = null;
    if (myVote) {
      const byTarget = new Map(myVote.ratings.map((r) => [r.targetId, r.value]));
      vote = {
        ratings: ordered.flatMap((p) =>
          byTarget.has(p.membershipId)
            ? [{ targetId: p.membershipId, value: byTarget.get(p.membershipId)! }]
            : [],
        ),
        mvpId: myVote.mvpId,
        flopId: myVote.flopId,
        updatedAt: myVote.updatedAt.toISOString(),
      };
    }

    return {
      roundId: round.id,
      number: round.number,
      scheduledAt: round.scheduledAt.toISOString(),
      status: round.status,
      openedAt: round.votingOpenedAt?.toISOString() ?? null,
      deadline: round.votingOpenedAt
        ? votingDeadline(round.votingOpenedAt, round.group.votingDeadlineHours).toISOString()
        : null,
      closedAt: round.closedAt?.toISOString() ?? null,
      closeReason: round.votingEndReason,
      serverTime: now.toISOString(),
      players,
      progress: {
        voted: active.filter((p) => voted.has(p.membershipId)).length,
        total: active.length,
      },
      // Só o admin vê quem falta (nunca o voto de ninguém).
      pending:
        isAdmin && round.status === 'VOTING'
          ? active.filter((p) => !voted.has(p.membershipId)).map(toVotingPlayer)
          : isAdmin
            ? []
            : null,
      me: { membershipId: membership.id, isAdmin, played: me !== null, vote },
      permissions: {
        vote: me !== null && open,
        close: isAdmin && round.status === 'VOTING',
      },
    };
  }

  private async requireRound(db: RoundTx, groupId: string, roundId: string) {
    const round = await this.findRound(db, groupId, roundId);
    if (!round) throw new NotFoundException();
    return round;
  }

  /** A rodada só se for do grupo da rota (nunca confiar no `groupId` do cliente). */
  findRound(db: RoundTx, groupId: string, roundId: string) {
    return db.round.findFirst({ where: { id: roundId, groupId }, select: ROUND_SELECT });
  }
}
