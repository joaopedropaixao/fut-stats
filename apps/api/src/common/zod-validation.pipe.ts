import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { z } from 'zod';

/**
 * Valida (e normaliza: trim etc.) a entrada com um schema do shared. Inválido → 400 com as mensagens.
 * Uso: `@Body(new ZodValidationPipe(createGroupSchema)) body: CreateGroupInput`.
 */
export class ZodValidationPipe<T extends z.ZodType> implements PipeTransform<unknown, z.output<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.output<T> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Dados inválidos',
        issues: result.error.issues.map(({ path, message }) => ({ path: path.join('.'), message })),
      });
    }
    return result.data;
  }
}
