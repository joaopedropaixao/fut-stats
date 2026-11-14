import { randomBytes } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  compareNicknames,
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
import { PrismaService } from '../prisma/prisma.service';

/** Tentativas com o slug "bonito" se outro grupo pegar o mesmo no meio do caminho; depois, sufixo aleatório. */
const SLUG_ATTEMPTS = 5;

/** Grupo + nº de membros ativos numa consulta só. */
const GROUP_WITH_COUNT = {
  id: true,
  name: true,
  slug: true,
  _count: { select: { memberships: { where: { active: true } } } },
} as const;

/** Código do link de convite: 12 caracteres url-safe (72 bits aleatórios). */
function newInviteCode(): string {
  return randomBytes(9).toString('base64url');
}

/** Sufixo de desempate quando vários grupos com o mesmo nome são criados ao mesmo tempo. */
function randomSlugSuffix(): string {
  return randomBytes(3).toString('hex');
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
    let taken = await this.takenSlugs(base);
    for (let attempt = 1; ; attempt += 1) {
      // Corrida (outro grupo pegou o mesmo slug no meio): relê e tenta de novo; por último, com sufixo aleatório.
      const next = nextAvailableSlug(base, taken);
      const slug = attempt <= SLUG_ATTEMPTS ? next : `${next}-${randomSlugSuffix()}`;
      try {
        const group = await this.prisma.group.create({
          select: { ...GROUP_WITH_COUNT, memberships: { select: { id: true } } },
          data: {
            name: input.name,
            slug,
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
        return toGroupResponse(group, 'ADMIN', group.memberships[0]!.id);
      } catch (e) {
        // Colidir de novo já com sufixo aleatório é erro de verdade.
        if (!isUniqueViolation(e) || attempt > SLUG_ATTEMPTS) throw e;
        taken = await this.takenSlugs(base);
      }
    }
  }

  /** O grupo visto pelo membro da rota (já conferido pelo guard). */
  async get(membership: GroupMembership): Promise<GroupResponse> {
    const group = await this.prisma.group.findUniqueOrThrow({
      where: { id: membership.groupId },
      select: GROUP_WITH_COUNT,
    });
    return toGroupResponse(group, membership.role, membership.id);
  }

  /** Membros ativos do grupo, em ordem alfabética de apelido (pt-BR). Sem nota: isso é do admin. */
  async listMembers(membership: GroupMembership): Promise<Member[]> {
    // A ordem é regra do domain (compareNicknames); a collation do Postgres (C, en_US...) não segue o português.
    // O banco só garante o desempate estável (quem entrou primeiro, depois id).
    const members = await this.prisma.membership.findMany({
      where: { groupId: membership.groupId, active: true },
      select: {
        id: true,
        nickname: true,
        photoUrl: true,
        role: true,
        primaryPosition: true,
        secondaryPositions: true,
        isHiredGoalkeeper: true,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return members.sort((a, b) => compareNicknames(a.nickname, b.nickname));
  }

  async getInvite(membership: GroupMembership): Promise<Invite> {
    assertAdmin(membership);
    const { inviteCode } = await this.prisma.group.findUniqueOrThrow({
      where: { id: membership.groupId },
      select: { inviteCode: true },
    });
    return { code: inviteCode };
  }

  /** Troca o código do convite: o antigo deixa de valer na hora. */
  async regenerateInvite(membership: GroupMembership): Promise<Invite> {
    assertAdmin(membership);
    const { inviteCode } = await this.prisma.group.update({
      where: { id: membership.groupId },
      data: { inviteCode: newInviteCode() },
      select: { inviteCode: true },
    });
    return { code: inviteCode };
  }

  /** Prévia pública do convite. Código inválido (ou trocado) → 404. */
  async preview(code: string): Promise<InvitePreview> {
    const group = await this.findByInviteCode(code);
    return { groupName: group.name, memberCount: group._count.memberships };
  }

  /**
   * Entra no grupo do convite como PLAYER. Já é membro ativo → devolve o grupo sem mexer em nada.
   * Inativo → 409 (só o admin reativa).
   */
  async join(userId: string, code: string, input: JoinGroupInput): Promise<JoinResult> {
    const group = await this.findByInviteCode(code);
    const where = { userId_groupId: { userId, groupId: group.id } };
    const select = { id: true, role: true, active: true } as const;

    let existing = await this.prisma.membership.findUnique({ where, select });
    if (!existing) {
      try {
        // Conta depois de inserir, na mesma transação: com entradas simultâneas, o número sai certo.
        const [created, memberCount] = await this.prisma.$transaction([
          this.prisma.membership.create({
            data: {
              userId,
              groupId: group.id,
              role: 'PLAYER',
              nickname: input.nickname,
              primaryPosition: input.primaryPosition,
              initialRating: DEFAULT_INITIAL_RATING,
            },
            select: { id: true },
          }),
          this.prisma.membership.count({ where: { groupId: group.id, active: true } }),
        ]);
        const joined = { ...group, _count: { memberships: memberCount } };
        return { group: toGroupResponse(joined, 'PLAYER', created.id), created: true };
      } catch (e) {
        // Clique simultâneo: o outro acabou de criar. Segue como "já tem participação".
        if (!isUniqueViolation(e)) throw e;
        existing = await this.prisma.membership.findUniqueOrThrow({ where, select });
      }
    }
    if (validateJoinGroup(existing) === 'MEMBERSHIP_INACTIVE') {
      throw new ConflictException({
        code: 'MEMBERSHIP_INACTIVE',
        message: JOIN_GROUP_ERROR_LABELS.MEMBERSHIP_INACTIVE,
      });
    }
    return { group: toGroupResponse(group, existing.role, existing.id), created: false };
  }

  private async findByInviteCode(code: string) {
    const group = await this.prisma.group.findUnique({
      where: { inviteCode: code },
      select: GROUP_WITH_COUNT,
    });
    if (!group) throw new NotFoundException();
    return group;
  }

  /** Só `base` e `base-<n>`: slugs que só começam igual (`pelada-do-ze`) não interessam. */
  private async takenSlugs(base: string): Promise<string[]> {
    const rows = await this.prisma.group.findMany({
      where: { OR: [{ slug: base }, { slug: { startsWith: `${base}-` } }] },
      select: { slug: true },
    });
    // `base` só tem [a-z0-9-] (toSlug), então entra na regex sem escapar.
    const ownSlug = new RegExp(`^${base}(-[0-9]+)?$`);
    return rows.map((r) => r.slug).filter((slug) => ownSlug.test(slug));
  }
}

/** Defesa em profundidade: a rota já exige `@GroupRole('ADMIN')`, mas o service não confia só nela. */
function assertAdmin(membership: GroupMembership): void {
  if (membership.role !== 'ADMIN') throw new ForbiddenException();
}

function toGroupResponse(
  group: { id: string; name: string; slug: string; _count: { memberships: number } },
  role: GroupResponse['role'],
  membershipId: string,
): GroupResponse {
  return {
    id: group.id,
    name: group.name,
    slug: group.slug,
    role,
    membershipId,
    memberCount: group._count.memberships,
  };
}
