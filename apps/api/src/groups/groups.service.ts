import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  compareNicknames,
  DEFAULT_INITIAL_RATING,
  isNicknameTaken,
  nextAvailableSlug,
  toSlug,
  validateJoinGroup,
  validateMemberAdminChange,
  validatePlayerPositions,
} from '@fut-stats/domain';
import {
  JOIN_GROUP_ERROR_LABELS,
  MEMBER_ADMIN_CHANGE_ERROR_LABELS,
  NICKNAME_TAKEN_LABEL,
  NOT_OWN_PROFILE_LABEL,
  PLAYER_POSITIONS_ERROR_LABELS,
  type CreateGroupInput,
  type GroupResponse,
  type Invite,
  type InvitePreview,
  type JoinGroupInput,
  type Member,
  type RosterMember,
  type UpdateMemberInput,
} from '@fut-stats/shared';
import type { GroupMembership } from '../auth/request';
import { AVATAR_SELECT, fromAvatar, toAvatar } from '../common/avatar';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type Tx = Prisma.TransactionClient;

/** Tentativas com o slug "bonito" se outro grupo pegar o mesmo no meio do caminho; depois, sufixo aleatório. */
const SLUG_ATTEMPTS = 5;

/** Grupo + nº de membros ativos numa consulta só. */
const GROUP_WITH_COUNT = {
  id: true,
  name: true,
  slug: true,
  _count: { select: { memberships: { where: { active: true } } } },
} as const;

/** O que o Member (e a resposta do grupo, que traz "quem sou eu") precisa da participação. */
const MEMBER_SELECT = {
  id: true,
  nickname: true,
  photoUrl: true,
  role: true,
  primaryPosition: true,
  secondaryPositions: true,
  isHiredGoalkeeper: true,
  ...AVATAR_SELECT,
} as const;

/** Mais o que só o admin vê no Elenco. */
const ROSTER_SELECT = { ...MEMBER_SELECT, initialRating: true, active: true } as const;

/** Campos do PATCH que só o admin muda. */
const ADMIN_ONLY_FIELDS = ['initialRating', 'isHiredGoalkeeper', 'role', 'active'] as const;

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
          select: { ...GROUP_WITH_COUNT, memberships: { select: MEMBER_SELECT } },
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
                ...fromAvatar(input.avatar),
              },
            },
          },
        });
        return toGroupResponse(group, group.memberships[0]!);
      } catch (e) {
        // Colidir de novo já com sufixo aleatório é erro de verdade.
        if (!isUniqueViolation(e) || attempt > SLUG_ATTEMPTS) throw e;
        taken = await this.takenSlugs(base);
      }
    }
  }

  /** O grupo visto pelo membro da rota (já conferido pelo guard). */
  async get(membership: GroupMembership): Promise<GroupResponse> {
    const [group, me] = await Promise.all([
      this.prisma.group.findUniqueOrThrow({
        where: { id: membership.groupId },
        select: GROUP_WITH_COUNT,
      }),
      this.prisma.membership.findUniqueOrThrow({
        where: { id: membership.id },
        select: MEMBER_SELECT,
      }),
    ]);
    return toGroupResponse(group, me);
  }

  /** Membros ativos do grupo, em ordem alfabética de apelido (pt-BR). Sem nota: isso é do admin. */
  async listMembers(membership: GroupMembership): Promise<Member[]> {
    // A ordem é regra do domain (compareNicknames); a collation do Postgres (C, en_US...) não segue o português.
    // O banco só garante o desempate estável (quem entrou primeiro, depois id).
    const members = await this.prisma.membership.findMany({
      where: { groupId: membership.groupId, active: true },
      select: MEMBER_SELECT,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return members.sort((a, b) => compareNicknames(a.nickname, b.nickname)).map(toMember);
  }

  /** Um membro do grupo. Inativo: só o admin vê (para os outros, é como se não existisse). */
  async getMember(membership: GroupMembership, membershipId: string): Promise<Member> {
    const target = await this.prisma.membership.findFirst({
      where: { id: membershipId, groupId: membership.groupId },
      select: { ...MEMBER_SELECT, active: true },
    });
    if (!target || (!target.active && membership.role !== 'ADMIN')) throw new NotFoundException();
    return toMember(target);
  }

  /** O elenco (admin): todos os membros, ativos primeiro; em cada bloco, por apelido (pt-BR). */
  async roster(membership: GroupMembership): Promise<RosterMember[]> {
    assertAdmin(membership);
    const members = await this.prisma.membership.findMany({
      where: { groupId: membership.groupId },
      select: ROSTER_SELECT,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return members
      .sort(
        (a, b) => Number(b.active) - Number(a.active) || compareNicknames(a.nickname, b.nickname),
      )
      .map(toRosterMember);
  }

  /**
   * Edita um membro. O próprio edita o perfil (apelido, bonequinho, posições); o admin edita o de qualquer um e
   * também nota inicial, goleiro contratado, papel e ativo. Tudo roda numa transação que trava a linha do grupo:
   * apelido único e "sempre sobra um admin" valem mesmo com pedidos ao mesmo tempo.
   * Ordem das checagens: próprio ou admin → campos de admin → `validateMemberAdminChange` → posições → apelido.
   */
  async updateMember(
    membership: GroupMembership,
    membershipId: string,
    input: UpdateMemberInput,
  ): Promise<Member | RosterMember> {
    return this.prisma.$transaction(async (tx) => {
      await lockGroup(tx, membership.groupId);

      // O papel vale o de agora (lido com a trava), não o do guard: dois admins se rebaixando juntos não zeram os admins.
      const actor = await tx.membership.findFirst({
        where: { id: membership.id, groupId: membership.groupId, active: true },
        select: { id: true, role: true },
      });
      if (!actor) throw new NotFoundException();
      const target = await tx.membership.findFirst({
        where: { id: membershipId, groupId: membership.groupId },
        select: ROSTER_SELECT,
      });
      if (!target) throw new NotFoundException();
      const isAdmin = actor.role === 'ADMIN';

      if (!isAdmin && target.id !== actor.id) {
        throw new ForbiddenException({ code: 'NOT_OWN_PROFILE', message: NOT_OWN_PROFILE_LABEL });
      }
      if (!isAdmin && ADMIN_ONLY_FIELDS.some((field) => input[field] !== undefined)) {
        throw new ForbiddenException({
          code: 'NOT_ADMIN',
          message: 'Só o admin muda a nota inicial, o goleiro contratado, o papel e se está ativo',
        });
      }

      // Repetir o valor de agora não é mudança (a tela do admin manda o formulário todo).
      const [selfChange] = validateMemberAdminChange(actor.id, target.id, {
        role: input.role !== target.role ? input.role : undefined,
        active: input.active !== target.active ? input.active : undefined,
      });
      if (selfChange) {
        throw new ConflictException({
          code: selfChange,
          message: MEMBER_ADMIN_CHANGE_ERROR_LABELS[selfChange],
        });
      }

      if (input.primaryPosition !== undefined || input.secondaryPositions !== undefined) {
        const errors = validatePlayerPositions(
          input.primaryPosition ?? target.primaryPosition,
          input.secondaryPositions ?? target.secondaryPositions,
        );
        if (errors.length > 0) {
          throw new BadRequestException({
            message: 'Dados inválidos',
            issues: errors.map((error) => ({
              path:
                input.secondaryPositions !== undefined ? 'secondaryPositions' : 'primaryPosition',
              message: PLAYER_POSITIONS_ERROR_LABELS[error],
            })),
          });
        }
      }

      // Inativo não prende apelido: só confere quando o membro termina ativo e o apelido é novo ou ele está voltando.
      const renamed = input.nickname !== undefined && input.nickname !== target.nickname;
      const reactivated = input.active === true && !target.active;
      if ((input.active ?? target.active) && (renamed || reactivated)) {
        await assertNicknameFree(
          tx,
          membership.groupId,
          input.nickname ?? target.nickname,
          target.id,
        );
      }

      const updated = await tx.membership.update({
        where: { id: target.id },
        select: ROSTER_SELECT,
        data: {
          nickname: input.nickname,
          primaryPosition: input.primaryPosition,
          secondaryPositions: input.secondaryPositions,
          initialRating: input.initialRating,
          isHiredGoalkeeper: input.isHiredGoalkeeper,
          role: input.role,
          active: input.active,
          ...(input.avatar ? fromAvatar(input.avatar) : {}),
        },
      });
      return isAdmin ? toRosterMember(updated) : toMember(updated);
    });
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
   * Inativo → 409 (só o admin reativa). Apelido de outro ativo → 409. Tudo na transação que trava o grupo,
   * então dois pedidos juntos com o mesmo apelido (ou o mesmo usuário clicando duas vezes) viram fila.
   */
  async join(userId: string, code: string, input: JoinGroupInput): Promise<JoinResult> {
    const group = await this.findByInviteCode(code);
    return this.prisma.$transaction(async (tx) => {
      await lockGroup(tx, group.id);

      const existing = await tx.membership.findUnique({
        where: { userId_groupId: { userId, groupId: group.id } },
        select: { ...MEMBER_SELECT, active: true },
      });
      if (existing) {
        if (validateJoinGroup(existing) === 'MEMBERSHIP_INACTIVE') {
          throw new ConflictException({
            code: 'MEMBERSHIP_INACTIVE',
            message: JOIN_GROUP_ERROR_LABELS.MEMBERSHIP_INACTIVE,
          });
        }
        return { group: toGroupResponse(group, existing), created: false };
      }

      await assertNicknameFree(tx, group.id, input.nickname, null);
      const created = await tx.membership.create({
        select: MEMBER_SELECT,
        data: {
          userId,
          groupId: group.id,
          role: 'PLAYER',
          nickname: input.nickname,
          primaryPosition: input.primaryPosition,
          initialRating: DEFAULT_INITIAL_RATING,
          ...fromAvatar(input.avatar),
        },
      });
      const memberCount = await tx.membership.count({ where: { groupId: group.id, active: true } });
      return {
        group: toGroupResponse({ ...group, _count: { memberships: memberCount } }, created),
        created: true,
      };
    });
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

/** Trava a linha do grupo até o fim da transação: quem chega depois espera e vê o que o primeiro gravou. */
async function lockGroup(tx: Tx, groupId: string): Promise<void> {
  const locked = await tx.$queryRaw<{ locked: number }[]>`
    SELECT 1 AS locked FROM "Group" WHERE id = ${groupId} FOR UPDATE`;
  if (locked.length === 0) throw new NotFoundException();
}

/** Outro membro **ativo** do grupo já usa o apelido (ignora maiúscula e acento)? → 409 `NICKNAME_TAKEN`. */
async function assertNicknameFree(
  tx: Tx,
  groupId: string,
  nickname: string,
  exceptId: string | null,
): Promise<void> {
  const others = await tx.membership.findMany({
    where: { groupId, active: true, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { nickname: true },
  });
  if (
    isNicknameTaken(
      nickname,
      others.map((m) => m.nickname),
    )
  ) {
    throw new ConflictException({ code: 'NICKNAME_TAKEN', message: NICKNAME_TAKEN_LABEL });
  }
}

type MemberRow = Prisma.MembershipGetPayload<{ select: typeof MEMBER_SELECT }>;
type RosterRow = Prisma.MembershipGetPayload<{ select: typeof ROSTER_SELECT }>;

function toMember(row: MemberRow): Member {
  return {
    id: row.id,
    nickname: row.nickname,
    photoUrl: row.photoUrl,
    role: row.role,
    primaryPosition: row.primaryPosition,
    secondaryPositions: row.secondaryPositions,
    isHiredGoalkeeper: row.isHiredGoalkeeper,
    avatar: toAvatar(row),
  };
}

function toRosterMember(row: RosterRow): RosterMember {
  return { ...toMember(row), initialRating: row.initialRating, active: row.active };
}

/** O grupo visto por quem pediu: o papel, o id, o apelido e o bonequinho dele ali. */
function toGroupResponse(
  group: { id: string; name: string; slug: string; _count: { memberships: number } },
  me: MemberRow,
): GroupResponse {
  return {
    id: group.id,
    name: group.name,
    slug: group.slug,
    role: me.role,
    membershipId: me.id,
    nickname: me.nickname,
    avatar: toAvatar(me),
    memberCount: group._count.memberships,
  };
}
