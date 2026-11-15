import { Injectable, NotFoundException } from '@nestjs/common';
import {
  compareNicknames,
  matchResult,
  minRatedGames,
  playerStats,
  rankPlayers,
  rankTrend,
  referenceRating,
  type MatchResult,
  type PlayerRoundRecord,
  type Team,
} from '@fut-stats/domain';
import type { PlayerProfile, PlayerRound, Ranking, RankingPlayer } from '@fut-stats/shared';
import type { GroupMembership } from '../auth/request';
import { AVATAR_SELECT, toAvatar } from '../common/avatar';
import { PrismaService } from '../prisma/prisma.service';

type Db = Pick<PrismaService, 'membership' | 'teamPlayer'>;

/** Quantas rodadas o perfil mostra em "ÚLTIMAS RODADAS". */
const LAST_ROUNDS = 5;

/** Uma rodada encerrada que o jogador jogou: o registro do domain e o que o perfil mostra dela. */
interface PlayedRound {
  record: PlayerRoundRecord;
  round: Pick<PlayerRound, 'roundId' | 'number' | 'scheduledAt'>;
  team: Team;
}

/** O ranking calculado: os jogadores ativos na ordem de exibição e o que o perfil precisa de cada um. */
interface Computed {
  closedRounds: number;
  minRatedGames: number;
  players: RankingPlayer[];
  played: Map<string, PlayedRound[]>;
}

@Injectable()
export class RankingService {
  constructor(private readonly prisma: PrismaService) {}

  /** O ranking do grupo: classificados na ordem, depois os de poucos jogos. */
  async list(membership: GroupMembership): Promise<Ranking> {
    const { closedRounds, minRatedGames, players } = await this.compute(membership.groupId);
    return { closedRounds, minRatedGames, players, me: { membershipId: membership.id } };
  }

  /** A figurinha de um jogador ativo do grupo; outro grupo, inativo ou inexistente é 404. */
  async profile(membership: GroupMembership, membershipId: string): Promise<PlayerProfile> {
    const member = await this.prisma.membership.findFirst({
      where: { id: membershipId, groupId: membership.groupId, active: true },
      select: { secondaryPositions: true, isHiredGoalkeeper: true, role: true },
    });
    if (!member) throw new NotFoundException();

    const [computed, references] = await Promise.all([
      this.compute(membership.groupId),
      this.referenceRatings(membership.groupId),
    ]);
    const player = computed.players.find((p) => p.membershipId === membershipId);
    if (!player) throw new NotFoundException();

    const lastRounds = (computed.played.get(membershipId) ?? [])
      .slice(-LAST_ROUNDS)
      .reverse()
      .map(({ record, round, team }) => ({
        ...round,
        team,
        result: record.result,
        score: record.score,
        goals: record.goals,
        assists: record.assists,
        isMvp: record.mvp,
        isFlop: record.flop,
      }));
    return {
      ...player,
      secondaryPositions: member.secondaryPositions,
      isHiredGoalkeeper: member.isHiredGoalkeeper,
      role: member.role,
      referenceRating: references.get(membershipId)!,
      lastRounds,
    };
  }

  /**
   * Nota de referência de cada membro do grupo (ativo ou não, para quem já foi escalado e saiu): a média das
   * 5 últimas notas de rodada encerrada, com a nota inicial do admin completando as que faltam. É o
   * `Player.rating` do seletor, do card de equilíbrio e da lista de presença. `db` aceita a transação.
   */
  async referenceRatings(groupId: string, db: Db = this.prisma): Promise<Map<string, number>> {
    const [members, scored] = await Promise.all([
      db.membership.findMany({ where: { groupId }, select: { id: true, initialRating: true } }),
      db.teamPlayer.findMany({
        where: { round: { groupId, status: 'CLOSED' }, roundScore: { not: null } },
        select: { membershipId: true, roundScore: true },
        orderBy: [{ round: { scheduledAt: 'asc' } }, { round: { number: 'asc' } }],
      }),
    ]);
    const scores = new Map<string, number[]>();
    for (const { membershipId, roundScore } of scored) {
      // O filtro garante a nota; o `?? 0` só estreita o tipo.
      const list = scores.get(membershipId) ?? [];
      list.push(roundScore ?? 0);
      scores.set(membershipId, list);
    }
    return new Map(
      members.map((m) => [m.id, referenceRating(m.initialRating, scores.get(m.id) ?? [])]),
    );
  }

  private async compute(groupId: string): Promise<Computed> {
    const [rounds, members] = await Promise.all([
      this.prisma.round.findMany({
        where: { groupId, status: 'CLOSED' },
        // Da mais antiga para a mais recente: a ordem que `playerStats` espera (a sequência olha o fim).
        orderBy: [{ scheduledAt: 'asc' }, { number: 'asc' }],
        select: {
          id: true,
          number: true,
          scheduledAt: true,
          whiteGoals: true,
          blackGoals: true,
          teamPlayers: {
            select: {
              membershipId: true,
              team: true,
              position: true,
              isReserve: true,
              roundScore: true,
              isMvp: true,
              isFlop: true,
            },
          },
          matchEvents: { select: { membershipId: true, type: true } },
        },
      }),
      this.prisma.membership.findMany({
        where: { groupId, active: true },
        select: { id: true, nickname: true, primaryPosition: true, ...AVATAR_SELECT },
      }),
    ]);

    const played = new Map<string, PlayedRound[]>();
    for (const round of rounds) {
      const score = { WHITE: round.whiteGoals ?? 0, BLACK: round.blackGoals ?? 0 };
      const tally = new Map<string, { goals: number; assists: number; ownGoals: number }>();
      for (const event of round.matchEvents) {
        const t = tally.get(event.membershipId) ?? { goals: 0, assists: 0, ownGoals: 0 };
        if (event.type === 'GOAL') t.goals += 1;
        else if (event.type === 'ASSIST') t.assists += 1;
        else t.ownGoals += 1;
        tally.set(event.membershipId, t);
      }
      for (const tp of round.teamPlayers) {
        const events = tally.get(tp.membershipId);
        const result: MatchResult = matchResult(score, tp.team);
        const record: PlayerRoundRecord = {
          result,
          goals: events?.goals ?? 0,
          assists: events?.assists ?? 0,
          ownGoals: events?.ownGoals ?? 0,
          score: tp.roundScore,
          mvp: tp.isMvp,
          flop: tp.isFlop,
          // Goleiro é quem jogou na vaga de goleiro: reserva não tem vaga fixa.
          playedAsGoalkeeper: !tp.isReserve && tp.position === 'GOALKEEPER',
          goalsConceded: tp.team === 'WHITE' ? score.BLACK : score.WHITE,
        };
        const list = played.get(tp.membershipId) ?? [];
        list.push({
          record,
          team: tp.team,
          round: {
            roundId: round.id,
            number: round.number,
            scheduledAt: round.scheduledAt.toISOString(),
          },
        });
        played.set(tp.membershipId, list);
      }
    }

    const closedRounds = rounds.length;
    const min = minRatedGames(closedRounds);
    const lastRoundId = rounds[rounds.length - 1]?.id;
    const statsOf = (id: string, withoutLast = false) =>
      playerStats(
        (played.get(id) ?? [])
          .filter((p) => !(withoutLast && p.round.roundId === lastRoundId))
          .map((p) => p.record),
      );
    const generalRanks = (withoutLast: boolean, minimum: number) =>
      rankPlayers(
        members.map((m) => ({ id: m.id, ...statsOf(m.id, withoutLast) })),
        { minRatedGames: minimum },
      );

    const stats = new Map(members.map((m) => [m.id, statsOf(m.id)]));
    const ranks = generalRanks(false, min);
    const positionRanks = new Map<string, number | null>();
    for (const position of new Set(members.map((m) => m.primaryPosition))) {
      const ofPosition = members.filter((m) => m.primaryPosition === position);
      const ranked = rankPlayers(
        ofPosition.map((m) => ({ id: m.id, ...stats.get(m.id)! })),
        { minRatedGames: min },
      );
      for (const [id, rank] of ranked) positionRanks.set(id, rank);
    }
    // Com e sem a última rodada encerrada, cada um com o mínimo que o grupo tinha naquela hora.
    const trends =
      closedRounds === 0
        ? new Map<string, number | null>()
        : rankTrend(generalRanks(true, minRatedGames(closedRounds - 1)), ranks);

    const players = members.map((m): RankingPlayer => {
      const { goalkeeper, ...rest } = stats.get(m.id)!;
      return {
        membershipId: m.id,
        nickname: m.nickname,
        avatar: toAvatar(m),
        primaryPosition: m.primaryPosition,
        rank: ranks.get(m.id) ?? null,
        positionRank: positionRanks.get(m.id) ?? null,
        trend: trends.get(m.id) ?? null,
        stats: { ...rest, goalkeeper: m.primaryPosition === 'GOALKEEPER' ? goalkeeper : null },
      };
    });
    players.sort(byDisplayOrder);
    return { closedRounds, minRatedGames: min, players, played };
  }
}

/** Classificados por posição (empate pelo apelido); depois os de poucos jogos, por jogos e apelido. */
function byDisplayOrder(a: RankingPlayer, b: RankingPlayer): number {
  if (a.rank !== null && b.rank !== null) {
    return a.rank - b.rank || compareNicknames(a.nickname, b.nickname);
  }
  if (a.rank !== null) return -1;
  if (b.rank !== null) return 1;
  return b.stats.games - a.stats.games || compareNicknames(a.nickname, b.nickname);
}
