import { Controller, Get, Logger, Param, Req, Res, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RoundStreamEvent } from '@fut-stats/shared';
import type { Request, Response } from 'express';
import { CurrentMembership, GroupMember } from '../auth/group-access.decorator';
import type { GroupMembership } from '../auth/request';
import type { Env } from '../config/env';
import { RoundEventsService, type RoundEvent } from '../events/round-events.service';
import { LiveService } from './live.service';

/** Quanto tempo o navegador espera antes de reconectar sozinho (campo `retry` do SSE). */
const RETRY_MS = 3000;

/**
 * O canal ao vivo da rodada (Server-Sent Events). O aviso só diz o que mudou; quem recebe busca o dado pela
 * rota de sempre, com as próprias permissões.
 */
@Controller('groups/:groupId/rounds/:roundId/stream')
export class LiveController implements OnModuleDestroy {
  private readonly logger = new Logger(LiveController.name);
  /** Fecha cada conexão aberta: o `app.close()` espera o fim delas. */
  private readonly open = new Set<() => void>();

  constructor(
    private readonly live: LiveService,
    private readonly events: RoundEventsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onModuleDestroy(): void {
    for (const close of [...this.open]) close();
  }

  @GroupMember()
  @Get()
  async stream(
    @CurrentMembership() membership: GroupMembership,
    @Param('roundId') roundId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    // 404 antes de abrir o fluxo: o filtro de exceção responde normalmente.
    await this.live.requireRound(membership, roundId);

    res.status(200).set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Nginx e afins seguram a resposta até encher o buffer; isto manda repassar na hora.
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();

    // Escrever numa conexão quebrada não pode derrubar quem escreve (o emissor roda dentro da escrita de outro).
    const write = (chunk: string): void => {
      try {
        res.write(chunk);
      } catch (error) {
        this.logger.warn(
          `Falha ao escrever no canal: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    };

    write(`event: ready\ndata: {}\nretry: ${RETRY_MS}\n\n`);

    // Um ouvinte do sinal único da rodada: repassa só `{ scopes, at }`. Nem o tipo nem o ator saem daqui.
    const unsubscribe = this.events.subscribe(membership.groupId, roundId, (event: RoundEvent) => {
      const changed: RoundStreamEvent = { scopes: [...event.scopes], at: new Date().toISOString() };
      write(`event: changed\ndata: ${JSON.stringify(changed)}\n\n`);
    });
    const heartbeat = setInterval(
      () => write(': ping\n\n'),
      this.config.get('STREAM_HEARTBEAT_MS', { infer: true }),
    );

    let done = false;
    const close = (): void => {
      if (done) return;
      done = true;
      clearInterval(heartbeat);
      unsubscribe();
      this.open.delete(close);
      if (!res.writableEnded) res.end();
    };
    this.open.add(close);
    // O cliente fechou (ou a rede caiu): para de ouvir. `res`, não `req`: o `close` da requisição dispara cedo.
    res.on('close', close);
    req.on('error', close);
  }
}
