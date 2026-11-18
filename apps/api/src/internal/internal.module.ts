import { type DynamicModule, Module } from '@nestjs/common';
import { VotingModule } from '../voting/voting.module';
import { InternalController } from './internal.controller';
import { TICK_SECRET, TickSecretGuard } from './tick-secret.guard';

/**
 * Rotas internas (o despertador). Só são registradas com `TICK_SECRET` no ambiente (só na produção): sem ele o
 * módulo sobe vazio e `/api/internal/*` responde 404, no mesmo desenho do `DevModule`.
 */
@Module({})
export class InternalModule {
  static forEnvironment(tickSecret: string | undefined = process.env.TICK_SECRET): DynamicModule {
    if (!tickSecret) return { module: InternalModule, imports: [], controllers: [], providers: [] };
    return {
      module: InternalModule,
      imports: [VotingModule],
      controllers: [InternalController],
      providers: [TickSecretGuard, { provide: TICK_SECRET, useValue: tickSecret }],
    };
  }
}
