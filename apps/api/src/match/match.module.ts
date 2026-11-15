import { Module } from '@nestjs/common';
import { MatchController } from './match.controller';
import { RoundLockModule } from '../rounds/round-lock.module';
import { MatchService } from './match.service';

@Module({
  imports: [RoundLockModule],
  controllers: [MatchController],
  providers: [MatchService],
})
export class MatchModule {}
