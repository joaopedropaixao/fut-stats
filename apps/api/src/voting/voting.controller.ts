import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put } from '@nestjs/common';
import {
  ratingEntrySchema,
  submitVoteSchema,
  type RoundResult,
  type SubmitVoteInput,
  type VotingView,
} from '@fut-stats/shared';
import { z } from 'zod';
import { CurrentMembership, GroupMember } from '../auth/group-access.decorator';
import type { GroupMembership } from '../auth/request';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { VotingService } from './voting.service';

/**
 * O corpo do voto é o `submitVoteSchema` do shared, com a nota só como número: o passo e a faixa da nota quem
 * confere é o domain (`INVALID_STEP`, `OUT_OF_RANGE`), para o erro sair com o `code` e o texto da regra.
 */
const submitVoteBodySchema = submitVoteSchema.extend({
  ratings: z.array(ratingEntrySchema.extend({ value: z.number() })).max(40),
});

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
    @Body(new ZodValidationPipe(submitVoteBodySchema)) body: SubmitVoteInput,
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
