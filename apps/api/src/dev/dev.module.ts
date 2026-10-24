import { type DynamicModule, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DevController } from './dev.controller';

/**
 * Rotas de desenvolvimento (login sem Google). Só são registradas com NODE_ENV=development: em teste e
 * em produção (o padrão quando NODE_ENV falta) o módulo sobe vazio e `/api/dev/*` responde 404.
 */
@Module({})
export class DevModule {
  static forEnvironment(nodeEnv = process.env.NODE_ENV): DynamicModule {
    const enabled = nodeEnv === 'development';
    return {
      module: DevModule,
      imports: enabled ? [AuthModule] : [],
      controllers: enabled ? [DevController] : [],
    };
  }
}
