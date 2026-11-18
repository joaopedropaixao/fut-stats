import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import {
  launchMatchEventSchema,
  startRotationSchema,
  setMatchScoreSchema,
  DEFAULT_ROTATION_MINUTES,
  type LaunchMatchEventInput,
  type MatchView,
  type StartRotationInput,
  type SetMatchScoreInput,
} from '@fut-stats/shared';
import { CurrentMembership, GroupMember } from '../auth/group-access.decorator';
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

  /** Só admin, conferido no service (`NOT_ADMIN` com `{ code, message }`); o guard só barra quem não é do grupo (404). */
  @GroupMember()
  @Post('start')
  @HttpCode(HttpStatus.OK)
  start(
    @CurrentMembership() membership: GroupMembership,
    @Param('roundId') roundId: string,
  ): Promise<MatchView> {
    return this.match.start(membership, roundId);
  }

  /** Só admin lança o placar: jogador comum → 403 `NOT_ADMIN`. */
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
  @Post('finish')
  @HttpCode(HttpStatus.OK)
  finish(
    @CurrentMembership() membership: GroupMembership,
    @Param('roundId') roundId: string,
    @Body(new ZodValidationPipe(setMatchScoreSchema)) body: SetMatchScoreInput,
  ): Promise<MatchView> {
    return this.match.finish(membership, roundId, body);
  }

  @GroupMember()
  @Post('rotation')
  @HttpCode(HttpStatus.OK)
  startRotation(
    @CurrentMembership() membership: GroupMembership,
    @Param('roundId') roundId: string,
    @Body(new ZodValidationPipe(startRotationSchema.optional())) body?: StartRotationInput,
  ): Promise<MatchView> {
    return this.match.startRotation(
      membership,
      roundId,
      body ?? { minutes: DEFAULT_ROTATION_MINUTES },
    );
  }

  @GroupMember()
  @Delete('rotation')
  @HttpCode(HttpStatus.OK)
  stopRotation(
    @CurrentMembership() membership: GroupMembership,
    @Param('roundId') roundId: string,
  ): Promise<MatchView> {
    return this.match.stopRotation(membership, roundId);
  }

  @GroupMember()
  @Post('open-voting')
  @HttpCode(HttpStatus.OK)
  openVoting(
    @CurrentMembership() membership: GroupMembership,
    @Param('roundId') roundId: string,
  ): Promise<MatchView> {
    return this.match.openVoting(membership, roundId);
  }

  /** Quem pode lançar é do domain (`validateMatchEvent`): dono do lance, ou admin. */
  @GroupMember()
  @Post('events')
  @HttpCode(HttpStatus.OK)
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
