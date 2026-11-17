import { EventEmitter } from 'node:events';
import { Injectable, Logger } from '@nestjs/common';

/** O que mudou na rodada, para quem busca o dado de novo: o jogo, a votação ou a etapa. */
export type RoundEventScope = 'match' | 'voting' | 'status';

/** O que aconteceu. Os nomes iguais aos da `AuditAction` são a mesma ação; `ROUND_CREATED`, `ROTATION_*` e `VOTE_CAST` não vão para o registro. */
export type RoundEventType =
  | 'ROUND_CREATED'
  | 'TEAMS_PUBLISHED'
  | 'TEAMS_UNPUBLISHED'
  | 'MATCH_STARTED'
  | 'SCORE_SET'
  | 'MATCH_FINISHED'
  | 'VOTING_OPENED'
  | 'EVENT_LAUNCHED'
  | 'EVENT_REMOVED'
  | 'ROTATION_STARTED'
  | 'ROTATION_STOPPED'
  | 'VOTE_CAST'
  | 'VOTING_CLOSED';

/**
 * O sinal de uma escrita da rodada que já foi gravada. Não carrega dado de domínio: quem ouve busca o que precisa.
 * Nunca leva o conteúdo de um voto.
 */
export interface RoundEvent {
  groupId: string;
  roundId: string;
  type: RoundEventType;
  scopes: readonly RoundEventScope[];
  /** Quem pediu a escrita; `null` quando ninguém pediu (último voto, prazo vencido, relógio da API). */
  actorMembershipId: string | null;
}

export type RoundEventListener = (event: RoundEvent) => void;

const ALL = 'round-event';

/**
 * O sinal único de eventos da rodada, em memória e dentro de um processo só. Quem escreve na rodada chama `emit`
 * **depois** que a transação resolveu; quem se interessa ouve (`on` para tudo, `subscribe` para uma rodada): o
 * canal ao vivo (SSE), o push, e o que vier. Com mais de uma instância da API, o `EventEmitter` troca por
 * `LISTEN/NOTIFY` do Postgres sem mudar esta interface.
 */
@Injectable()
export class RoundEventsService {
  private readonly logger = new Logger(RoundEventsService.name);
  private readonly emitter = new EventEmitter();

  constructor() {
    // Cada conexão aberta é um ouvinte: não existe limite razoável.
    this.emitter.setMaxListeners(0);
  }

  /** Avisa os ouvintes. Nunca lança: erro é registrado e engolido, e um ouvinte com erro não impede os outros. */
  emit(event: RoundEvent): void {
    try {
      this.emitter.emit(ALL, event);
      this.emitter.emit(channel(event.groupId, event.roundId), event);
    } catch (error) {
      this.logger.error(
        `Falha ao sinalizar ${event.type} na rodada ${event.roundId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /** Ouve tudo o que acontece em qualquer rodada. Devolve a função que cancela. */
  on(listener: RoundEventListener): () => void {
    return this.listen(ALL, listener);
  }

  /** Ouve uma rodada só. Devolve a função que cancela. */
  subscribe(groupId: string, roundId: string, listener: RoundEventListener): () => void {
    return this.listen(channel(groupId, roundId), listener);
  }

  /** Quantos ouvintes a rodada tem agora (não conta quem ouve tudo). */
  listenerCount(groupId: string, roundId: string): number {
    return this.emitter.listenerCount(channel(groupId, roundId));
  }

  private listen(name: string, listener: RoundEventListener): () => void {
    const safe: RoundEventListener = (event) => {
      try {
        listener(event);
      } catch (error) {
        this.logger.warn(
          `Ouvinte de ${event.type} falhou: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    };
    this.emitter.on(name, safe);
    return () => {
      this.emitter.off(name, safe);
    };
  }
}

/** O grupo entra no nome do canal: rodada de outro grupo nunca cruza, mesmo com o mesmo id. */
function channel(groupId: string, roundId: string): string {
  return `${groupId}:${roundId}`;
}
