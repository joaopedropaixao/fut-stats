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
import type { GroupMembership } from '../auth/request';
import { AVATAR_SELECT, toAvatar } from '../common/avatar';
import type { Role } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';

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
  constructor(private readonly prisma: PrismaService) {}

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

  async create(membership: GroupMembership, input: PostInput): Promise<Post> {
    // Rota só de admin (guard); a regra do domain fica como segunda trava.
    this.requireManager(membership);
    const post = await this.prisma.post.create({
      data: {
        groupId: membership.groupId,
        authorId: membership.id,
        title: input.title ?? null,
        body: input.body,
      },
      select: { id: true },
    });
    return this.view(membership, post.id);
  }

  /** Qualquer admin edita qualquer resenha; o autor continua o original. */
  async update(membership: GroupMembership, postId: string, input: PostInput): Promise<Post> {
    this.requireManager(membership);
    const { count } = await this.prisma.post.updateMany({
      where: { id: postId, groupId: membership.groupId },
      data: { title: input.title ?? null, body: input.body, editedAt: new Date() },
    });
    if (count === 0) throw new NotFoundException();
    return this.view(membership, postId);
  }

  /** Reações e comentários saem junto (cascata no banco). */
  async remove(membership: GroupMembership, postId: string): Promise<void> {
    this.requireManager(membership);
    const { count } = await this.prisma.post.deleteMany({
      where: { id: postId, groupId: membership.groupId },
    });
    if (count === 0) throw new NotFoundException();
  }

  /** Troca a reação de quem pede (uma por pessoa por resenha). Dois pedidos juntos dão uma linha só. */
  async react(
    membership: GroupMembership,
    postId: string,
    { reaction }: ReactionInput,
  ): Promise<Post> {
    await this.requirePost(membership, postId);
    const key = { postId_membershipId: { postId, membershipId: membership.id } };
    const save = () =>
      this.prisma.postReaction.upsert({
        where: key,
        create: { postId, membershipId: membership.id, reaction },
        update: { reaction },
      });
    try {
      try {
        await save();
      } catch (error) {
        // Corrida de dois "criar" juntos: o segundo já encontra a linha e só troca.
        if (!hasPrismaCode(error, 'P2002')) throw error;
        await save();
      }
    } catch (error) {
      // A resenha foi apagada entre a conferência e a gravação.
      if (hasPrismaCode(error, 'P2003')) throw new NotFoundException();
      throw error;
    }
    return this.view(membership, postId);
  }

  async unreact(membership: GroupMembership, postId: string): Promise<Post> {
    await this.requirePost(membership, postId);
    await this.prisma.postReaction.deleteMany({ where: { postId, membershipId: membership.id } });
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

  async addComment(
    membership: GroupMembership,
    postId: string,
    { text }: CommentInput,
  ): Promise<Comment> {
    await this.requirePost(membership, postId);
    try {
      const row = await this.prisma.postComment.create({
        data: { postId, membershipId: membership.id, text },
        include: { membership: { select: authorSelect } },
      });
      return this.toComment(row, toActor(membership));
    } catch (error) {
      if (hasPrismaCode(error, 'P2003')) throw new NotFoundException();
      throw error;
    }
  }

  /** O autor ou um admin apaga; outro jogador recebe 403 `NOT_OWN_COMMENT`. Comentário de outra resenha: 404. */
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
    // Já pode ter sido apagado por outro (autor e admin juntos): o resultado é o mesmo.
    await this.prisma.postComment.deleteMany({ where: { id: comment.id } });
  }

  private requireManager(membership: GroupMembership): void {
    if (!canManagePost(toActor(membership))) throw new ForbiddenException();
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
