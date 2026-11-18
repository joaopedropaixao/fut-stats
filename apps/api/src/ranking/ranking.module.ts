import { Module } from '@nestjs/common';
import { RankingController } from './ranking.controller';
import { RankingService } from './ranking.service';

@Module({
  controllers: [RankingController],
  providers: [RankingService],
  // Rodadas e escalações usam a nota de referência no lugar da nota inicial.
  exports: [RankingService],
})
export class RankingModule {}
