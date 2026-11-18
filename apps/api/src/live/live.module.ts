import { Module } from '@nestjs/common';
import { RoundEventsModule } from '../events/round-events.module';
import { LiveController } from './live.controller';
import { LiveService } from './live.service';

/** Canal ao vivo da rodada (SSE): um ouvinte do sinal único de eventos (`RoundEventsModule`). */
@Module({
  imports: [RoundEventsModule],
  controllers: [LiveController],
  providers: [LiveService],
})
export class LiveModule {}
