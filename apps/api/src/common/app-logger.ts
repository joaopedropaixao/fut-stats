import { ConsoleLogger, type LoggerService } from '@nestjs/common';

/**
 * Logger do Nest de cada ambiente. Produção (e sem `NODE_ENV`, que vale produção) sai em JSON, uma linha por
 * registro, para o Render indexar. Dev usa o texto colorido padrão. Nos testes o `setupApp` silencia tudo.
 */
export function createAppLogger(nodeEnv: string | undefined): LoggerService | undefined {
  const env = nodeEnv ?? 'production';
  return env === 'production' ? new ConsoleLogger({ json: true }) : undefined;
}
