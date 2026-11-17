import { Module } from '@nestjs/common';
import { RoundEventsService } from './round-events.service';

/** O sinal único da rodada. Quem escreve na rodada, ou quer ouvir, importa este módulo e injeta o `RoundEventsService`. */
@Module({
  providers: [RoundEventsService],
  exports: [RoundEventsService],
})
export class RoundEventsModule {}
