import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import {
  changeMatchStatusSchema,
  launchMatchEventSchema,
  setMatchScoreSchema,
  type ChangeMatchStatusInput,
  type LaunchMatchEventInput,
  type MatchView,
  type SetMatchScoreInput,
} from '@fut-stats/shared';
import { CurrentMembership, GroupMember, GroupRole } from '../auth/group-access.decorator';
import type { GroupMembership } from '../auth/request';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { MatchService } from './match.service';

@Controller('groups/:groupId/rounds/:roundId/match')
export class MatchController {
  constructor(private readonly match: MatchService) {}

  @GroupMember()
  @Get()
  view(
    @CurrentMembership() membership: GroupMembership,
    @Param('roundId') roundId: string,
  ): Promise<MatchView> {
    return this.match.view(membership, roundId);
  }

  /** Começar o jogo ou encerrar o jogo (vai para a votação). */
  @GroupRole('ADMIN')
  @Patch('status')
  changeStatus(
    @CurrentMembership() membership: GroupMembership,
    @Param('roundId') roundId: string,
    @Body(new ZodValidationPipe(changeMatchStatusSchema)) body: ChangeMatchStatusInput,
  ): Promise<MatchView> {
    return this.match.changeStatus(membership, roundId, body);
  }

  /** Quem pode lançar o placar é do domain (`validateScoreEntry`): jogador comum → 403. */
  @GroupMember()
  @Put('score')
  setScore(
    @CurrentMembership() membership: GroupMembership,
    @Param('roundId') roundId: string,
    @Body(new ZodValidationPipe(setMatchScoreSchema)) body: SetMatchScoreInput,
  ): Promise<MatchView> {
    return this.match.setScore(membership, roundId, body);
  }

  @GroupMember()
  @Post('events')
  launchEvent(
    @CurrentMembership() membership: GroupMembership,
    @Param('roundId') roundId: string,
    @Body(new ZodValidationPipe(launchMatchEventSchema)) body: LaunchMatchEventInput,
  ): Promise<MatchView> {
    return this.match.launchEvent(membership, roundId, body);
  }

  @GroupMember()
  @Delete('events/:eventId')
  removeEvent(
    @CurrentMembership() membership: GroupMembership,
    @Param('roundId') roundId: string,
    @Param('eventId') eventId: string,
  ): Promise<MatchView> {
    return this.match.removeEvent(membership, roundId, eventId);
  }
}
