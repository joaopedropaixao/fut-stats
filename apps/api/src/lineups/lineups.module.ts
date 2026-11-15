import { Module } from '@nestjs/common';
import { RankingModule } from '../ranking/ranking.module';
import { LineupsController } from './lineups.controller';
import { LineupsService } from './lineups.service';

@Module({
  imports: [RankingModule],
  controllers: [LineupsController],
  providers: [LineupsService],
})
export class LineupsModule {}
