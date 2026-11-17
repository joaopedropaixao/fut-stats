import { Controller, Get, Param } from '@nestjs/common';
import type { RoundLogEntry } from '@fut-stats/shared';
import { CurrentMembership, GroupRole } from '../auth/group-access.decorator';
import type { GroupMembership } from '../auth/request';
import { AuditService } from './audit.service';

@Controller('groups/:groupId/rounds/:roundId/log')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  /** O registro da rodada. Só admin: jogador → 403; de outro grupo ou inativo → 404 (o guard). */
  @GroupRole('ADMIN')
  @Get()
  list(
    @CurrentMembership() membership: GroupMembership,
    @Param('roundId') roundId: string,
  ): Promise<RoundLogEntry[]> {
    return this.audit.list(membership, roundId);
  }
}
