import { Controller, Get, Param } from '@nestjs/common';
import type { PlayerProfile, Ranking } from '@fut-stats/shared';
import { CurrentMembership, GroupMember } from '../auth/group-access.decorator';
import type { GroupMembership } from '../auth/request';
import { RankingService } from './ranking.service';

/** Só leitura: qualquer membro ativo vê o ranking e o perfil de qualquer jogador ativo do grupo. */
@Controller('groups/:groupId')
export class RankingController {
  constructor(private readonly ranking: RankingService) {}

  @GroupMember()
  @Get('ranking')
  list(@CurrentMembership() membership: GroupMembership): Promise<Ranking> {
    return this.ranking.list(membership);
  }

  @GroupMember()
  @Get('members/:membershipId/stats')
  profile(
    @CurrentMembership() membership: GroupMembership,
    @Param('membershipId') membershipId: string,
  ): Promise<PlayerProfile> {
    return this.ranking.profile(membership, membershipId);
  }
}
