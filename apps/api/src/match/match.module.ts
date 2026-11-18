import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { RoundEventsModule } from '../events/round-events.module';
import { MatchController } from './match.controller';
import { RoundLockModule } from '../rounds/round-lock.module';
import { MatchService } from './match.service';

@Module({
  imports: [AuditModule, RoundEventsModule, RoundLockModule],
  controllers: [MatchController],
  providers: [MatchService],
})
export class MatchModule {}
