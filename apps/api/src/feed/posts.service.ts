import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  canDeleteComment,
  canManagePost,
  POST_REACTIONS,
  type PostReaction,
  type RoundActor,
} from '@fut-stats/domain';
import {
  NOT_OWN_COMMENT_LABEL,
  type Author,
  type Comment,
  type CommentInput,
  type Post,
  type PostInput,
  type PostList,
  type PostsQuery,
  type ReactionInput,
} from '@fut-stats/shared';
import { AuditService } from '../audit/audit.service';
import type { GroupMembership } from '../auth/request';
import { AVATAR_SELECT, toAvatar } from '../common/avatar';
import type { Prisma } from '../generated/prisma/client';
import type { Role } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';

type Tx = Prisma.TransactionClient;

/** Os comentários que a lista devolve: os mais recentes, em ordem de envio. */
const COMMENTS_LIMIT = 200;

const authorSelect = {
  id: true,
  nickname: true,
  role: true,
  ...AVATAR_SELECT,
} as const;

type AuthorRow = {
  id: string;
  nickname: string;
  role: Role;
  avatarSkin: Parameters<typeof toAvatar>[0]['avatarSkin'];
  avatarHair: Parameters<typeof toAvatar>[0]['avatarHair'];
  avatarHairColor: Parameters<typeof toAvatar>[0]['avatarHairColor'];
};

/** O autor aparece mesmo inativo: nada aqui filtra por `active`. */
function toAuthor(row: AuthorRow): Author {
  return {
    membershipId: row.id,
    nickname: row.nickname,
    avatar: toAvatar(row),
    role: row.role,
  };
}

function toActor(membership: GroupMembership): RoundActor {
  return { id: membership.id, isAdmin: membership.role === 'ADMIN' };
}

/** Todas as 5 reações, zeradas. */
function emptyReactions(): Record<PostReaction, number> {
  return Object.fromEntries(POST_REACTIONS.map((reaction) => [reaction, 0])) as Record<
    PostReaction,
    number
  >;
}

function hasPrismaCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}

/** O cursor é a posição (data + id) da última resenha da página: estável mesmo com resenha nova no topo. */
function encodeCursor(row: { createdAt: Date; id: string }): string {
  return Buffer.from(`${row.createdAt.toISOString()}|${row.id}`).toString('base64url');
}

function decodeCursor(cursor: string): { createdAt: Date; id: string } {
  const [iso, id] = Buffer.from(cursor, 'base64url').toString().split('|');
  const createdAt = new Date(iso ?? '');
  if (!id || Number.isNaN(createdAt.getTime())) {
    throw new BadRequestException({
      message: 'Dados inválidos',
      issues: [{ path: 'cursor', message: 'Cursor inválido' }],
    });
  }
  return { createdAt, id };
}

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Da mais nova para a mais antiga, em páginas. Reações, a minha e o número de comentários vêm em consultas por página. */
  async list(membership: GroupMembership, { limit, cursor }: PostsQuery): Promise<PostList> {
    const after = cursor ? decodeCursor(cursor) : null;
    const rows = await this.prisma.post.findMany({
      where: {
        groupId: membership.groupId,
        ...(after
          ? {
              OR: [
                { createdAt: { lt: after.createdAt } },
                { createdAt: after.createdAt, id: { lt: after.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: { author: { select: authorSelect } },
    });
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    return {
      items: await this.toPosts(membership, page),
      nextCursor: rows.length > limit && last ? encodeCursor(last) : null,
    };
  }

  async get(membership: GroupMembership, postId: string): Promise<Post> {
    return this.view(membership, postId);
  }

  async create(membership: GroupMembership, input: PostInput): Promise<Post> {
    // Rota só de admin (guard); a regra do domain fica como segunda trava.
    this.requireManager(membership);
    const post = await this.prisma.$transaction(async (tx) => {
      const created = await tx.post.create({
        data: {
          groupId: membership.groupId,
          authorId: membership.id,
          title: input.title ?? null,
          body: input.body,
        },
        select: { id: true, title: true, body: true },
      });
      await this.audit.recordForMember(
        tx,
        membership,
        { postId: created.id },
        'POST_CREATED',
        null,
        {
          postId: created.id,
          title: created.title,
          body: created.body,
        },
      );
      return created;
    });
    return this.view(membership, post.id);
  }

  /** Qualquer admin edita qualquer resenha; o autor continua o original. O registro guarda o texto antigo e o novo. */
  async update(membership: GroupMembership, postId: string, input: PostInput): Promise<Post> {
    this.requireManager(membership);
    await this.prisma.$transaction(async (tx) => {
      await this.lockPost(tx, membership, postId);
      const before = await tx.post.findFirstOrThrow({
        where: { id: postId, groupId: membership.groupId },
        select: { title: true, body: true },
      });
      const after = await tx.post.update({
        where: { id: postId },
        data: { title: input.title ?? null, body: input.body, editedAt: new Date() },
        select: { title: true, body: true },
      });
      await this.audit.recordForMember(
        tx,
        membership,
        { postId },
        'POST_EDITED',
        { postId, title: before.title, body: before.body },
        { postId, title: after.title, body: after.body },
      );
    });
    return this.view(membership, postId);
  }

  /** Reações e comentários saem junto (cascata no banco). O registro guarda o texto apagado e as contagens. */
  async remove(membership: GroupMembership, postId: string): Promise<void> {
    this.requireManager(membership);
    await this.prisma.$transaction(async (tx) => {
      await this.lockPost(tx, membership, postId);
      const post = await tx.post.findFirstOrThrow({
        where: { id: postId, groupId: membership.groupId },
        select: { authorId: true, title: true, body: true },
      });
      const [reactionCount, commentCount] = await Promise.all([
        tx.postReaction.count({ where: { postId } }),
        tx.postComment.count({ where: { postId } }),
      ]);
      await tx.post.delete({ where: { id: postId } });
      await this.audit.recordForMember(
        tx,
        membership,
        { postId },
        'POST_DELETED',
        {
          postId,
          authorId: post.authorId,
          title: post.title,
          body: post.body,
          reactionCount,
          commentCount,
        },
        null,
      );
    });
  }

  /**
   * Troca a reação de quem pede (uma por pessoa por resenha). Dois pedidos juntos do mesmo membro andam um de
   * cada vez (trava por resenha + membro), então o "antes" de cada linha do registro é sempre o "depois" da
   * anterior. Pedir a reação que já está não muda nada e não deixa linha.
   */
  async react(
    membership: GroupMembership,
    postId: string,
    { reaction }: ReactionInput,
  ): Promise<Post> {
    await this.requirePost(membership, postId);
    try {
      await this.prisma.$transaction(async (tx) => {
        await this.lockReaction(tx, postId, membership.id);
        const current = await tx.postReaction.findUnique({
          where: { postId_membershipId: { postId, membershipId: membership.id } },
          select: { reaction: true },
        });
        if (current?.reaction === reaction) return;
        await tx.postReaction.upsert({
          where: { postId_membershipId: { postId, membershipId: membership.id } },
          create: { postId, membershipId: membership.id, reaction },
          update: { reaction },
        });
        await this.audit.recordForMember(
          tx,
          membership,
          { postId },
          'REACTION_SET',
          { postId, reaction: current?.reaction ?? null },
          { postId, reaction },
        );
      });
    } catch (error) {
      // A resenha foi apagada entre a conferência e a gravação.
      if (hasPrismaCode(error, 'P2003')) throw new NotFoundException();
      throw error;
    }
    return this.view(membership, postId);
  }

  async unreact(membership: GroupMembership, postId: string): Promise<Post> {
    await this.requirePost(membership, postId);
    await this.prisma.$transaction(async (tx) => {
      await this.lockReaction(tx, postId, membership.id);
      const removed = await tx.postReaction.findUnique({
        where: { postId_membershipId: { postId, membershipId: membership.id } },
        select: { reaction: true },
      });
      // Sem reação para tirar: nada muda e nada é registrado.
      if (!removed) return;
      // deleteMany é idempotente: se a resenha foi apagada no meio (cascata), não apaga nada, não registra e o
      // `view` abaixo responde 404 (o `delete` lançaria P2025 e viraria 500).
      const { count } = await tx.postReaction.deleteMany({
        where: { postId, membershipId: membership.id },
      });
      if (count === 0) return;
      await this.audit.recordForMember(
        tx,
        membership,
        { postId },
        'REACTION_REMOVED',
        { postId, reaction: removed.reaction },
        null,
      );
    });
    return this.view(membership, postId);
  }

  /** Em ordem de envio; no máximo os 200 mais recentes. */
  async listComments(membership: GroupMembership, postId: string): Promise<Comment[]> {
    await this.requirePost(membership, postId);
    const rows = await this.prisma.postComment.findMany({
      where: { postId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: COMMENTS_LIMIT,
      include: { membership: { select: authorSelect } },
    });
    const actor = toActor(membership);
    return rows.reverse().map((row) => this.toComment(row, actor));
  }

  /** O registro guarda só o tamanho (em caracteres): o texto já está no comentário. */
  async addComment(
    membership: GroupMembership,
    postId: string,
    { text }: CommentInput,
  ): Promise<Comment> {
    await this.requirePost(membership, postId);
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const created = await tx.postComment.create({
          data: { postId, membershipId: membership.id, text },
          include: { membership: { select: authorSelect } },
        });
        await this.audit.recordForMember(tx, membership, { postId }, 'COMMENT_CREATED', null, {
          postId,
          commentId: created.id,
          length: Array.from(text).length,
        });
        return created;
      });
      return this.toComment(row, toActor(membership));
    } catch (error) {
      if (hasPrismaCode(error, 'P2003')) throw new NotFoundException();
      throw error;
    }
  }

  /**
   * O autor ou um admin apaga; outro jogador recebe 403 `NOT_OWN_COMMENT`. Comentário de outra resenha: 404.
   * O registro guarda o texto apagado e o autor. Quem chega depois de outro que já apagou o mesmo comentário
   * tem o resultado que queria e não deixa linha (só quem apagou de verdade registra).
   */
  async removeComment(
    membership: GroupMembership,
    postId: string,
    commentId: string,
  ): Promise<void> {
    const comment = await this.prisma.postComment.findFirst({
      where: { id: commentId, postId, post: { groupId: membership.groupId } },
      select: { id: true, membershipId: true },
    });
    if (!comment) throw new NotFoundException();
    if (!canDeleteComment(toActor(membership), comment.membershipId)) {
      throw new ForbiddenException({ code: 'NOT_OWN_COMMENT', message: NOT_OWN_COMMENT_LABEL });
    }
    await this.prisma.$transaction(async (tx) => {
      // Apagar devolve a linha apagada; se outro já apagou, não há o que registrar.
      const deleted = await tx.$queryRaw<{ text: string; membershipId: string }[]>`
        DELETE FROM "PostComment" WHERE id = ${comment.id} RETURNING text, "membershipId"`;
      const [gone] = deleted;
      if (!gone) return;
      await this.audit.recordForMember(
        tx,
        membership,
        { postId },
        'COMMENT_DELETED',
        { postId, commentId: comment.id, authorId: gone.membershipId, text: gone.text },
        null,
      );
    });
  }

  private requireManager(membership: GroupMembership): void {
    if (!canManagePost(toActor(membership))) throw new ForbiddenException();
  }

  /** Trava a resenha (`FOR UPDATE`) para o "antes" do registro ser o que o pedido anterior deixou. Outro grupo ou sem resenha: 404. */
  private async lockPost(tx: Tx, membership: GroupMembership, postId: string): Promise<void> {
    const locked = await tx.$queryRaw<{ locked: number }[]>`
      SELECT 1 AS locked FROM "Post" WHERE id = ${postId} AND "groupId" = ${membership.groupId} FOR UPDATE`;
    if (locked.length === 0) throw new NotFoundException();
  }

  /** Um pedido de reação por vez, por resenha e membro (vale até o fim da transação). */
  private async lockReaction(tx: Tx, postId: string, membershipId: string): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`reaction:${postId}:${membershipId}`}))`;
  }

  /** A resenha tem de ser do grupo da rota; senão 404 (não revela resenha de outro grupo). */
  private async requirePost(membership: GroupMembership, postId: string): Promise<void> {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, groupId: membership.groupId },
      select: { id: true },
    });
    if (!post) throw new NotFoundException();
  }

  private async view(membership: GroupMembership, postId: string): Promise<Post> {
    const row = await this.prisma.post.findFirst({
      where: { id: postId, groupId: membership.groupId },
      include: { author: { select: authorSelect } },
    });
    if (!row) throw new NotFoundException();
    const [post] = await this.toPosts(membership, [row]);
    return post!;
  }

  /** Monta as resenhas de uma página com três consultas (contagens de reação, a minha e comentários), sem N+1. */
  private async toPosts(
    membership: GroupMembership,
    rows: readonly {
      id: string;
      title: string | null;
      body: string;
      createdAt: Date;
      editedAt: Date | null;
      author: AuthorRow;
    }[],
  ): Promise<Post[]> {
    if (rows.length === 0) return [];
    const postIds = rows.map((row) => row.id);
    const [reactionCounts, mine, commentCounts] = await Promise.all([
      this.prisma.postReaction.groupBy({
        by: ['postId', 'reaction'],
        where: { postId: { in: postIds } },
        _count: { _all: true },
      }),
      this.prisma.postReaction.findMany({
        where: { postId: { in: postIds }, membershipId: membership.id },
        select: { postId: true, reaction: true },
      }),
      this.prisma.postComment.groupBy({
        by: ['postId'],
        where: { postId: { in: postIds } },
        _count: { _all: true },
      }),
    ]);

    const reactionsOf = new Map<string, Record<PostReaction, number>>();
    for (const { postId, reaction, _count } of reactionCounts) {
      const counts = reactionsOf.get(postId) ?? emptyReactions();
      counts[reaction] = _count._all;
      reactionsOf.set(postId, counts);
    }
    const myReactionOf = new Map(mine.map((row) => [row.postId, row.reaction]));
    const commentsOf = new Map(commentCounts.map((row) => [row.postId, row._count._all]));
    const canManage = canManagePost(toActor(membership));

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      author: toAuthor(row.author),
      createdAt: row.createdAt.toISOString(),
      editedAt: row.editedAt?.toISOString() ?? null,
      reactions: reactionsOf.get(row.id) ?? emptyReactions(),
      myReaction: myReactionOf.get(row.id) ?? null,
      commentCount: commentsOf.get(row.id) ?? 0,
      canManage,
    }));
  }

  private toComment(
    row: { id: string; text: string; createdAt: Date; membershipId: string; membership: AuthorRow },
    actor: RoundActor,
  ): Comment {
    return {
      id: row.id,
      author: toAuthor(row.membership),
      text: row.text,
      createdAt: row.createdAt.toISOString(),
      canDelete: canDeleteComment(actor, row.membershipId),
    };
  }
}
