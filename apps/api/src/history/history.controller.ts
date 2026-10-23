import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  historyQuerySchema,
  type HistoryDetail,
  type HistoryList,
  type HistoryQuery,
} from '@fut-stats/shared';
import { CurrentMembership, GroupMember } from '../auth/group-access.decorator';
import type { GroupMembership } from '../auth/request';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { HistoryService } from './history.service';

/** Só leitura: qualquer membro do grupo vê as partidas já jogadas. */
@Controller('groups/:groupId/history')
export class HistoryController {
  constructor(private readonly history: HistoryService) {}

  @GroupMember()
  @Get()
  list(
    @CurrentMembership() membership: GroupMembership,
    @Query(new ZodValidationPipe(historyQuerySchema)) query: HistoryQuery,
  ): Promise<HistoryList> {
    return this.history.list(membership.groupId, query);
  }

  @GroupMember()
  @Get(':roundId')
  detail(
    @CurrentMembership() membership: GroupMembership,
    @Param('roundId') roundId: string,
  ): Promise<HistoryDetail> {
    return this.history.detail(membership.groupId, roundId);
  }
}
