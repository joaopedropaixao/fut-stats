import { Module } from '@nestjs/common';
import { RoundLockService } from './round-lock.service';

/** A trava por rodada, para os módulos que escrevem nela (`match`, `voting`). */
@Module({
  providers: [RoundLockService],
  exports: [RoundLockService],
})
export class RoundLockModule {}
