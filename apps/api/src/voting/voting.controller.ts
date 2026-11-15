import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put } from '@nestjs/common';
import {
  submitVoteSchema,
  type RoundResult,
  type SubmitVoteInput,
  type VotingView,
} from '@fut-stats/shared';
import { CurrentMembership, GroupMember } from '../auth/group-access.decorator';
import type { GroupMembership } from '../auth/request';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { VotingService } from './voting.service';

@Controller('groups/:groupId/rounds/:roundId/voting')
export class VotingController {
  constructor(private readonly voting: VotingService) {}

  @GroupMember()
  @Get()
  view(
    @CurrentMembership() membership: GroupMembership,
    @Param('roundId') roundId: string,
  ): Promise<VotingView> {
    return this.voting.view(membership, roundId);
  }

  /** Quem jogou, com a votação aberta; o pacote inteiro, e enviar de novo substitui. */
  @GroupMember()
  @Put('vote')
  submitVote(
    @CurrentMembership() membership: GroupMembership,
    @Param('roundId') roundId: string,
    @Body(new ZodValidationPipe(submitVoteSchema)) body: SubmitVoteInput,
  ): Promise<VotingView> {
    return this.voting.submitVote(membership, roundId, body);
  }

  /** Só admin, conferido no service (`NOT_ADMIN` com `{ code, message }`); o guard só barra quem não é do grupo (404). */
  @GroupMember()
  @Post('close')
  @HttpCode(HttpStatus.OK)
  close(
    @CurrentMembership() membership: GroupMembership,
    @Param('roundId') roundId: string,
  ): Promise<VotingView> {
    return this.voting.close(membership, roundId);
  }

  @GroupMember()
  @Get('result')
  result(
    @CurrentMembership() membership: GroupMembership,
    @Param('roundId') roundId: string,
  ): Promise<RoundResult> {
    return this.voting.result(membership, roundId);
  }
}
