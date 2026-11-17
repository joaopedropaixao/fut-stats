import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { RankingModule } from '../ranking/ranking.module';
import { LineupsController } from './lineups.controller';
import { LineupsService } from './lineups.service';

@Module({
  imports: [AuditModule, RankingModule],
  controllers: [LineupsController],
  providers: [LineupsService],
})
export class LineupsModule {}
