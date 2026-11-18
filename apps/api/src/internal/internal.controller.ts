import { Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { tickResultSchema, type TickResult } from '@fut-stats/shared';
import { Public } from '../auth/public.decorator';
import { VotingService } from '../voting/voting.service';
import { TickSecretGuard } from './tick-secret.guard';

/**
 * Webhook do despertador (GitHub Actions, de 30 em 30 minutos, só em produção). Não é para o app: a sessão não vale
 * aqui (`@Public()` tira o guard de sessão) e o guard próprio exige o `TICK_SECRET`.
 */
@Public()
@UseGuards(TickSecretGuard)
@Controller('internal')
export class InternalController {
  constructor(private readonly voting: VotingService) {}

  /** Fecha as votações vencidas de todos os grupos, pelo mesmo caminho do relógio (registro, sinal e push saem dele). */
  @Post('tick')
  @HttpCode(200)
  async tick(): Promise<TickResult> {
    const closedVotings = await this.voting.closeDueVotings(new Date());
    return tickResultSchema.parse({ closedVotings });
  }
}
