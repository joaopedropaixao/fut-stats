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
} from '@nestjs/common';
import {
  createRoundSchema,
  setAttendanceSchema,
  updateRoundSchema,
  type CreateRoundInput,
  type RoundDetail,
  type RoundList,
  type SetAttendanceInput,
  type UpdateRoundInput,
} from '@fut-stats/shared';
import { CurrentMembership, GroupMember, GroupRole } from '../auth/group-access.decorator';
import type { GroupMembership } from '../auth/request';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { RoundsService } from './rounds.service';

@Controller('groups/:groupId/rounds')
export class RoundsController {
  constructor(private readonly rounds: RoundsService) {}

  @GroupRole('ADMIN')
  @Post()
  create(
    @CurrentMembership() membership: GroupMembership,
    @Body(new ZodValidationPipe(createRoundSchema)) body: CreateRoundInput,
  ): Promise<RoundDetail> {
    return this.rounds.create(membership, body);
  }

  @GroupMember()
  @Get()
  list(@CurrentMembership() membership: GroupMembership): Promise<RoundList> {
    return this.rounds.list(membership.groupId);
  }

  @GroupMember()
  @Get(':roundId')
  detail(
    @CurrentMembership() membership: GroupMembership,
    @Param('roundId') roundId: string,
  ): Promise<RoundDetail> {
    return this.rounds.detail(membership, roundId);
  }

  @GroupRole('ADMIN')
  @Patch(':roundId')
  update(
    @CurrentMembership() membership: GroupMembership,
    @Param('roundId') roundId: string,
    @Body(new ZodValidationPipe(updateRoundSchema)) body: UpdateRoundInput,
  ): Promise<RoundDetail> {
    return this.rounds.update(membership, roundId, body);
  }

  @GroupRole('ADMIN')
  @Delete(':roundId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentMembership() membership: GroupMembership,
    @Param('roundId') roundId: string,
  ): Promise<void> {
    return this.rounds.remove(membership.groupId, roundId);
  }

  /** Vou / Não vou. O jogador marca a própria; o admin, a de qualquer membro (regra no domain). */
  @GroupMember()
  @Put(':roundId/attendances/:membershipId')
  setAttendance(
    @CurrentMembership() membership: GroupMembership,
    @Param('roundId') roundId: string,
    @Param('membershipId') membershipId: string,
    @Body(new ZodValidationPipe(setAttendanceSchema)) body: SetAttendanceInput,
  ): Promise<RoundDetail> {
    return this.rounds.setAttendance(membership, roundId, membershipId, body);
  }
}
