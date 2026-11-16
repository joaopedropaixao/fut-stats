import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  commentInputSchema,
  postInputSchema,
  postsQuerySchema,
  reactionInputSchema,
  type Comment,
  type CommentInput,
  type Post as PostView,
  type PostInput,
  type PostList,
  type PostsQuery,
  type ReactionInput,
} from '@fut-stats/shared';
import { CurrentMembership, GroupMember, GroupRole } from '../auth/group-access.decorator';
import type { GroupMembership } from '../auth/request';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PostsService } from './posts.service';

@Controller('groups/:groupId/posts')
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @GroupMember()
  @Get()
  list(
    @CurrentMembership() membership: GroupMembership,
    @Query(new ZodValidationPipe(postsQuerySchema)) query: PostsQuery,
  ): Promise<PostList> {
    return this.posts.list(membership, query);
  }

  @GroupRole('ADMIN')
  @Post()
  create(
    @CurrentMembership() membership: GroupMembership,
    @Body(new ZodValidationPipe(postInputSchema)) body: PostInput,
  ): Promise<PostView> {
    return this.posts.create(membership, body);
  }

  @GroupRole('ADMIN')
  @Patch(':postId')
  update(
    @CurrentMembership() membership: GroupMembership,
    @Param('postId') postId: string,
    @Body(new ZodValidationPipe(postInputSchema)) body: PostInput,
  ): Promise<PostView> {
    return this.posts.update(membership, postId, body);
  }

  @GroupRole('ADMIN')
  @Delete(':postId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentMembership() membership: GroupMembership,
    @Param('postId') postId: string,
  ): Promise<void> {
    return this.posts.remove(membership, postId);
  }

  /** Uma reação por pessoa: tocar em outra troca. */
  @GroupMember()
  @Put(':postId/reaction')
  react(
    @CurrentMembership() membership: GroupMembership,
    @Param('postId') postId: string,
    @Body(new ZodValidationPipe(reactionInputSchema)) body: ReactionInput,
  ): Promise<PostView> {
    return this.posts.react(membership, postId, body);
  }

  @GroupMember()
  @Delete(':postId/reaction')
  unreact(
    @CurrentMembership() membership: GroupMembership,
    @Param('postId') postId: string,
  ): Promise<PostView> {
    return this.posts.unreact(membership, postId);
  }

  @GroupMember()
  @Get(':postId/comments')
  comments(
    @CurrentMembership() membership: GroupMembership,
    @Param('postId') postId: string,
  ): Promise<Comment[]> {
    return this.posts.listComments(membership, postId);
  }

  @GroupMember()
  @Post(':postId/comments')
  comment(
    @CurrentMembership() membership: GroupMembership,
    @Param('postId') postId: string,
    @Body(new ZodValidationPipe(commentInputSchema)) body: CommentInput,
  ): Promise<Comment> {
    return this.posts.addComment(membership, postId, body);
  }

  /** Autor ou admin, conferido no service (`NOT_OWN_COMMENT` com `{ code, message }`). */
  @GroupMember()
  @Delete(':postId/comments/:commentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeComment(
    @CurrentMembership() membership: GroupMembership,
    @Param('postId') postId: string,
    @Param('commentId') commentId: string,
  ): Promise<void> {
    return this.posts.removeComment(membership, postId, commentId);
  }
}
