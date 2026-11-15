import { Module } from '@nestjs/common';
import { RankingModule } from '../ranking/ranking.module';
import { VotingModule } from '../voting/voting.module';
import { RoundsController } from './rounds.controller';
import { RoundsService } from './rounds.service';

@Module({
  imports: [VotingModule, RankingModule],
  controllers: [RoundsController],
  providers: [RoundsService],
})
export class RoundsModule {}
