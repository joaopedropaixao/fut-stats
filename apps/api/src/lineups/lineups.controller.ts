import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put } from '@nestjs/common';
import { saveLineupSchema, type Lineup, type SaveLineupInput } from '@fut-stats/shared';
import { CurrentMembership, GroupMember, GroupRole } from '../auth/group-access.decorator';
import type { GroupMembership } from '../auth/request';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { LineupsService } from './lineups.service';

@Controller('groups/:groupId/rounds/:roundId/lineup')
export class LineupsController {
  constructor(private readonly lineups: LineupsService) {}

  @GroupMember()
  @Get()
  get(
    @CurrentMembership() membership: GroupMembership,
    @Param('roundId') roundId: string,
  ): Promise<Lineup> {
    return this.lineups.get(membership, roundId);
  }

  @GroupRole('ADMIN')
  @Put()
  save(
    @CurrentMembership() membership: GroupMembership,
    @Param('roundId') roundId: string,
    @Body(new ZodValidationPipe(saveLineupSchema)) body: SaveLineupInput,
  ): Promise<Lineup> {
    return this.lineups.save(membership, roundId, body);
  }

  @GroupRole('ADMIN')
  @Post('publish')
  @HttpCode(HttpStatus.OK)
  publish(
    @CurrentMembership() membership: GroupMembership,
    @Param('roundId') roundId: string,
  ): Promise<Lineup> {
    return this.lineups.publish(membership, roundId);
  }

  @GroupRole('ADMIN')
  @Post('unpublish')
  @HttpCode(HttpStatus.OK)
  unpublish(
    @CurrentMembership() membership: GroupMembership,
    @Param('roundId') roundId: string,
  ): Promise<Lineup> {
    return this.lineups.unpublish(membership, roundId);
  }
}
