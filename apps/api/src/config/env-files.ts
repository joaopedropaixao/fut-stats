import { join } from 'node:path';

/**
 * Arquivos de ambiente de um repositório, do mais forte para o mais fraco (o primeiro a definir a variável vence):
 * o da equipe (portas e banco de um worktree em modo paralelo, só ele existe nesse caso) e o da raiz.
 */
export function envFilePaths(root: string): string[] {
  return [join(root, '.env.equipe'), join(root, '.env')];
}
