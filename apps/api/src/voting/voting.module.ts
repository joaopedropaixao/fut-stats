import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { RoundLockModule } from '../rounds/round-lock.module';
import { VotingCloser } from './voting-closer';
import { VotingController } from './voting.controller';
import { VotingService } from './voting.service';

@Module({
  imports: [AuditModule, RoundLockModule],
  controllers: [VotingController],
  providers: [VotingService, VotingCloser],
  // O `RoundsService` fecha o que venceu antes de listar as rodadas.
  exports: [VotingService],
})
export class VotingModule {}
