import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';
import { VotingService } from './voting.service';

/**
 * O relógio da API: de tempos em tempos, fecha as votações com o prazo vencido (`closeDueVotings`, todos os
 * grupos). É um dos três caminhos de fechamento (o último voto e quem abre o app depois do prazo são os outros).
 * `VOTING_CLOSER_INTERVAL_MS=0` desliga (os testes). O timer não segura o processo aberto (`unref`).
 */
@Injectable()
export class VotingCloser implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VotingCloser.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly voting: VotingService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onModuleInit(): void {
    const interval = this.config.get('VOTING_CLOSER_INTERVAL_MS', { infer: true });
    if (interval <= 0) return;
    this.timer = setInterval(() => void this.tick(), interval);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Uma volta do relógio. Não empilha: se a anterior ainda não acabou, pula. */
  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const closed = await this.voting.closeDueVotings(new Date());
      if (closed > 0) this.logger.log(`Votações fechadas: ${closed}`);
    } catch (error) {
      this.logger.error(
        'Falha ao fechar votações vencidas',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.running = false;
    }
  }
}
