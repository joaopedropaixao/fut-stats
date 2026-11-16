import { Controller, Get } from '@nestjs/common';
import type { FeedAlert } from '@fut-stats/shared';
import { CurrentMembership, GroupMember } from '../auth/group-access.decorator';
import type { GroupMembership } from '../auth/request';
import { FeedService } from './feed.service';

@Controller('groups/:groupId/feed')
export class FeedController {
  constructor(private readonly feed: FeedService) {}

  /** Avisos calculados do estado das rodadas, na ordem de prioridade (o primeiro é o aviso grande). */
  @GroupMember()
  @Get('alerts')
  alerts(@CurrentMembership() membership: GroupMembership): Promise<FeedAlert[]> {
    return this.feed.alerts(membership);
  }
}
