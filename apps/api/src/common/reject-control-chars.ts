import { hasInvalidCharacters } from '@fut-stats/domain';
import { HttpStatus, NotFoundException } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

/**
 * Caminho com caractere inválido (controle, quebra de linha, invisível; mesma regra do apelido no domain, ex.:
 * `/api/invites/%00`) não é rota de ninguém: 404 antes de chegar a guard,
 * service ou banco (o Postgres recusa `\0` com erro, que viraria 500). Vale para toda rota, inclusive as futuras.
 * Percent-encoding malformado segue adiante: o Express já responde 400.
 */
export function rejectControlCharsInPath(req: Request, res: Response, next: NextFunction): void {
  let path: string;
  try {
    path = decodeURIComponent(req.path);
  } catch {
    next();
    return;
  }
  if (hasInvalidCharacters(path)) {
    // Fora da cadeia de filtros do Nest: monta o mesmo corpo de um 404 comum.
    res.status(HttpStatus.NOT_FOUND).json(new NotFoundException().getResponse());
    return;
  }
  next();
}
