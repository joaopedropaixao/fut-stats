import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { envFilePaths } from './env-files';

/**
 * Põe no ambiente os arquivos de ambiente do repositório, sem sobrescrever o que já está lá (o ambiente do Render
 * vence; entre os arquivos, o da equipe vence o da raiz, como no `ConfigModule`). Arquivo que falta é ignorado.
 * Precisa rodar antes de o `AppModule` ser montado: o `InternalModule` e o Sentry leem o ambiente na hora de subir.
 */
export function loadEnvFiles(root: string, env: NodeJS.ProcessEnv = process.env): void {
  for (const file of envFilePaths(root)) {
    let text: string;
    try {
      text = readFileSync(file, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw error;
    }
    for (const [key, value] of Object.entries(parseEnv(text))) {
      if (env[key] === undefined && value !== undefined) env[key] = value;
    }
  }
}

/** A raiz do repositório quando a API roda a partir de `apps/api` (dev e Render): a mesma conta do `AppModule`. */
export function repositoryRoot(cwd: string = process.cwd()): string {
  return resolve(cwd, '../..');
}
