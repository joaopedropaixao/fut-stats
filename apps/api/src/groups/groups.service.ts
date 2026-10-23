import { randomBytes } from 'node:crypto';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DEFAULT_INITIAL_RATING,
  nextAvailableSlug,
  toSlug,
  validateJoinGroup,
} from '@fut-stats/domain';
import {
  JOIN_GROUP_ERROR_LABELS,
  type CreateGroupInput,
  type GroupResponse,
  type Invite,
  type InvitePreview,
  type JoinGroupInput,
  type Member,
} from '@fut-stats/shared';
import type { GroupMembership } from '../auth/request';
import { Prisma } from '../generated/prisma/client';
import type { Role } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';

/** Tentativas de criar o grupo se outro pegar o mesmo slug no meio do caminho. */
const SLUG_ATTEMPTS = 3;

/** Código do link de convite: 12 caracteres url-safe (72 bits aleatórios). */
function newInviteCode(): string {
  return randomBytes(9).toString('base64url');
}

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
}

export type JoinResult = { group: GroupResponse; created: boolean };

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Cria o grupo com quem criou como ADMIN (também jogador, com a nota inicial padrão). */
  async create(userId: string, input: CreateGroupInput): Promise<GroupResponse> {
    const base = toSlug(input.name);
    for (let attempt = 1; ; attempt += 1) {
      const taken = await this.prisma.group.findMany({
        where: { slug: { startsWith: base } },
        select: { slug: true },
      });
      try {
        const group = await this.prisma.group.create({
          data: {
            name: input.name,
            slug: nextAvailableSlug(
              base,
              taken.map((g) => g.slug),
            ),
            inviteCode: newInviteCode(),
            memberships: {
              create: {
                userId,
                role: 'ADMIN',
                nickname: input.nickname,
                primaryPosition: input.primaryPosition,
                initialRating: DEFAULT_INITIAL_RATING,
              },
            },
          },
        });
        return { id: group.id, name: group.name, slug: group.slug, role: 'ADMIN', memberCount: 1 };
      } catch (e) {
        if (isUniqueViolation(e) && attempt < SLUG_ATTEMPTS) continue;
        throw e;
      }
    }
  }

  /** O grupo visto pelo membro da rota (já conferido pelo guard). */
  async get(membership: GroupMembership): Promise<GroupResponse> {
    return this.toResponse(membership.groupId, membership.role);
  }

  /** Membros ativos do grupo, por apelido. Sem nota: isso é do admin. */
  async listMembers(groupId: string): Promise<Member[]> {
    return this.prisma.membership.findMany({
      where: { groupId, active: true },
      select: {
        id: true,
        nickname: true,
        photoUrl: true,
        role: true,
        primaryPosition: true,
        secondaryPositions: true,
        isHiredGoalkeeper: true,
      },
      orderBy: [{ nickname: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async getInvite(groupId: string): Promise<Invite> {
    const { inviteCode } = await this.prisma.group.findUniqueOrThrow({
      where: { id: groupId },
      select: { inviteCode: true },
    });
    return { code: inviteCode };
  }

  /** Troca o código do convite: o antigo deixa de valer na hora. */
  async regenerateInvite(groupId: string): Promise<Invite> {
    const { inviteCode } = await this.prisma.group.update({
      where: { id: groupId },
      data: { inviteCode: newInviteCode() },
      select: { inviteCode: true },
    });
    return { code: inviteCode };
  }

  /** Prévia pública do convite. Código inválido (ou trocado) → 404. */
  async preview(code: string): Promise<InvitePreview> {
    const group = await this.findByInviteCode(code);
    return { groupName: group.name, memberCount: await this.countActive(group.id) };
  }

  /**
   * Entra no grupo do convite como PLAYER. Já é membro ativo → devolve o grupo sem mexer em nada.
   * Inativo → 409 (só o admin reativa).
   */
  async join(userId: string, code: string, input: JoinGroupInput): Promise<JoinResult> {
    const group = await this.findByInviteCode(code);
    const where = { userId_groupId: { userId, groupId: group.id } };

    const existing = await this.prisma.membership.findUnique({
      where,
      select: { role: true, active: true },
    });
    if (validateJoinGroup(existing) === 'MEMBERSHIP_INACTIVE') {
      throw new ConflictException({
        code: 'MEMBERSHIP_INACTIVE',
        message: JOIN_GROUP_ERROR_LABELS.MEMBERSHIP_INACTIVE,
      });
    }
    if (existing) return { group: await this.toResponse(group.id, existing.role), created: false };

    try {
      await this.prisma.membership.create({
        data: {
          userId,
          groupId: group.id,
          role: 'PLAYER',
          nickname: input.nickname,
          primaryPosition: input.primaryPosition,
          initialRating: DEFAULT_INITIAL_RATING,
        },
      });
    } catch (e) {
      // Dois cliques ao mesmo tempo: o outro já criou. Trata como "já é membro".
      if (isUniqueViolation(e)) return this.join(userId, code, input);
      throw e;
    }
    return { group: await this.toResponse(group.id, 'PLAYER'), created: true };
  }

  private async findByInviteCode(code: string) {
    const group = await this.prisma.group.findUnique({
      where: { inviteCode: code },
      select: { id: true, name: true },
    });
    if (!group) throw new NotFoundException();
    return group;
  }

  private countActive(groupId: string): Promise<number> {
    return this.prisma.membership.count({ where: { groupId, active: true } });
  }

  private async toResponse(groupId: string, role: Role): Promise<GroupResponse> {
    const group = await this.prisma.group.findUniqueOrThrow({
      where: { id: groupId },
      select: { id: true, name: true, slug: true },
    });
    return { ...group, role, memberCount: await this.countActive(groupId) };
  }
}
