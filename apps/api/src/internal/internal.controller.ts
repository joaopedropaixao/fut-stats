import { Controller, HttpCode, HttpStatus, Post, Res, UseGuards } from '@nestjs/common';
import {
  sentryCheckResultSchema,
  tickResultSchema,
  type SentryCheckResult,
  type TickResult,
} from '@fut-stats/shared';
import type { Response } from 'express';
import { Public } from '../auth/public.decorator';
import { sendMonitoringCheck } from '../common/monitoring';
import { VotingService } from '../voting/voting.service';
import { TickSecretGuard } from './tick-secret.guard';

/**
 * Rotas internas, chamadas por máquina ou pelo dono, nunca pelo app: a sessão não vale aqui (`@Public()` tira o guard
 * de sessão) e o guard próprio exige o `TICK_SECRET`.
 */
@Public()
@UseGuards(TickSecretGuard)
@Controller('internal')
export class InternalController {
  constructor(private readonly voting: VotingService) {}

  /**
   * Webhook do despertador (GitHub Actions, de 30 em 30 minutos, só em produção). Fecha as votações vencidas de todos
   * os grupos pelo mesmo caminho do relógio (registro, sinal e push saem dele). Se alguma falhou, responde 500 com o
   * mesmo corpo: o job fica vermelho e o GitHub manda e-mail ao dono (cada falha já foi ao Sentry pelo serviço).
   */
  @Post('tick')
  async tick(@Res({ passthrough: true }) res: Response): Promise<TickResult> {
    const { closed, failed } = await this.voting.closeDueVotingsReport(new Date());
    res.status(failed > 0 ? HttpStatus.INTERNAL_SERVER_ERROR : HttpStatus.OK);
    return tickResultSchema.parse({ closedVotings: closed, failed });
  }

  /**
   * Conferência do Sentry (R5 do roteiro): manda uma mensagem info "Teste do Sentry" e diz se o Sentry estava ligado.
   * Só gasta cota quando o dono chama (a API não avisa mais a cada partida a frio).
   */
  @Post('sentry-check')
  @HttpCode(200)
  sentryCheck(): SentryCheckResult {
    return sentryCheckResultSchema.parse({ sent: sendMonitoringCheck() });
  }
}
