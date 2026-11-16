import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { MatchController } from './match.controller';
import { RoundLockModule } from '../rounds/round-lock.module';
import { MatchService } from './match.service';

@Module({
  imports: [AuditModule, RoundLockModule],
  controllers: [MatchController],
  providers: [MatchService],
})
export class MatchModule {}
