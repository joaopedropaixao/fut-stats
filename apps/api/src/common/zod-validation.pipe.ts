import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { z } from 'zod';

/**
 * Algum texto (em qualquer nível) com `\0`? O Postgres recusa e viraria 500 no banco. Só o `\0`: campo de texto
 * livre (ex.: resenha) pode ter quebra de linha; a regra de apelido/nome é do domain. Iterativo, sem recursão.
 */
function hasNullChar(root: unknown): boolean {
  const pending: unknown[] = [root];
  while (pending.length > 0) {
    const value = pending.pop();
    if (typeof value === 'string') {
      if (value.includes('\0')) return true;
    } else if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) {
        if (key.includes('\0')) return true;
        pending.push(child);
      }
    }
  }
  return false;
}

function badRequest(issues: { path: string; message: string }[]): BadRequestException {
  return new BadRequestException({ message: 'Dados inválidos', issues });
}

/**
 * Valida (e normaliza: trim etc.) a entrada com um schema do shared. Inválido → 400 com as mensagens.
 * Uso: `@Body(new ZodValidationPipe(createGroupSchema)) body: CreateGroupInput`.
 */
export class ZodValidationPipe<T extends z.ZodType> implements PipeTransform<unknown, z.output<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.output<T> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw badRequest(
        result.error.issues.map(({ path, message }) => ({ path: path.join('.'), message })),
      );
    }
    // Depois do schema: olha só o que segue para o service (campo desconhecido já foi descartado).
    if (hasNullChar(result.data)) {
      throw badRequest([{ path: '', message: 'Texto com caractere inválido' }]);
    }
    return result.data;
  }
}
