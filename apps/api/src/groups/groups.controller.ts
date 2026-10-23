import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Res } from '@nestjs/common';
import {
  createGroupSchema,
  joinGroupSchema,
  type CreateGroupInput,
  type GroupResponse,
  type Invite,
  type InvitePreview,
  type JoinGroupInput,
  type Member,
  type SessionUser,
} from '@fut-stats/shared';
import type { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import { CurrentMembership, GroupMember, GroupRole } from '../auth/group-access.decorator';
import { Public } from '../auth/public.decorator';
import type { GroupMembership } from '../auth/request';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { GroupsService } from './groups.service';

@Controller('groups')
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Post()
  create(
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(createGroupSchema)) body: CreateGroupInput,
  ): Promise<GroupResponse> {
    return this.groups.create(user.id, body);
  }

  @GroupMember()
  @Get(':groupId')
  get(@CurrentMembership() membership: GroupMembership): Promise<GroupResponse> {
    return this.groups.get(membership);
  }

  @GroupMember()
  @Get(':groupId/members')
  members(@CurrentMembership() membership: GroupMembership): Promise<Member[]> {
    return this.groups.listMembers(membership.groupId);
  }

  @GroupRole('ADMIN')
  @Get(':groupId/invite')
  invite(@CurrentMembership() membership: GroupMembership): Promise<Invite> {
    return this.groups.getInvite(membership.groupId);
  }

  /** Gera um código novo; o antigo deixa de valer. */
  @GroupRole('ADMIN')
  @Post(':groupId/invite')
  @HttpCode(HttpStatus.OK)
  regenerateInvite(@CurrentMembership() membership: GroupMembership): Promise<Invite> {
    return this.groups.regenerateInvite(membership.groupId);
  }
}

@Controller('invites')
export class InvitesController {
  constructor(private readonly groups: GroupsService) {}

  // Público: quem recebe o link vê para qual pelada foi convidado antes de logar.
  @Public()
  @Get(':code')
  preview(@Param('code') code: string): Promise<InvitePreview> {
    return this.groups.preview(code);
  }

  /** 201 se entrou agora; 200 se já era membro ativo. */
  @Post(':code/join')
  async join(
    @CurrentUser() user: SessionUser,
    @Param('code') code: string,
    @Body(new ZodValidationPipe(joinGroupSchema)) body: JoinGroupInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<GroupResponse> {
    const { group, created } = await this.groups.join(user.id, code, body);
    res.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return group;
  }
}
