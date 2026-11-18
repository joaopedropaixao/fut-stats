import { Module } from '@nestjs/common';
import { RoundEventsModule } from '../events/round-events.module';
import { RankingModule } from '../ranking/ranking.module';
import { VotingModule } from '../voting/voting.module';
import { RoundsController } from './rounds.controller';
import { RoundsService } from './rounds.service';

@Module({
  imports: [VotingModule, RankingModule, RoundEventsModule],
  controllers: [RoundsController],
  providers: [RoundsService],
})
export class RoundsModule {}
