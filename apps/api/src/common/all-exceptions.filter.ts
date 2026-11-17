import { HttpException, HttpStatus, Logger, type ArgumentsHost } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { Request, Response } from 'express';
import { annotateRequestContext, getRequestId } from './request-context';

/** Só no log de pedido: o corpo do 400 de validação não ganha campo novo. */
const VALIDATION_ERROR_CODE = 'VALIDATION_FAILED';

/** Erro de HTTP que não é `HttpException` (ex.: corpo grande demais no body-parser): o Nest trata como o status dele. */
function isHttpError(exception: unknown): boolean {
  const { statusCode, message } = (exception ?? {}) as { statusCode?: unknown; message?: unknown };
  return typeof statusCode === 'number' && typeof message === 'string';
}

/** Código do erro para o log de pedido: o `code` do corpo (ex.: `NOT_OWN_COMMENT`); validação do Zod = `VALIDATION_FAILED`. */
export function errorCodeOf(exception: HttpException): string | undefined {
  const body = exception.getResponse();
  if (typeof body !== 'object' || body === null) return undefined;
  const { code, issues } = body as { code?: unknown; issues?: unknown };
  if (typeof code === 'string' && code.length > 0) return code;
  return Array.isArray(issues) ? VALIDATION_ERROR_CODE : undefined;
}

/**
 * Filtro global. O que o Nest já sabe responder (`HttpException`, erros de HTTP) segue como sempre. O resto é
 * 500: loga o erro com a pilha e o `requestId`, e responde `{ statusCode, message, requestId }` sem a pilha.
 */
export class AllExceptionsFilter extends BaseExceptionFilter {
  private readonly errorLogger = new Logger('Exceptions');

  override catch(exception: unknown, host: ArgumentsHost): void {
    if (exception instanceof HttpException || isHttpError(exception)) {
      if (exception instanceof HttpException) {
        const errorCode = errorCodeOf(exception);
        if (errorCode) annotateRequestContext({ errorCode });
      }
      super.catch(exception, host);
      return;
    }

    const http = host.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const requestId = getRequestId();
    const error = exception instanceof Error ? exception : new Error(String(exception));
    this.errorLogger.error(
      {
        requestId,
        method: req.method,
        path: req.originalUrl.split('?')[0],
        message: error.message,
      },
      error.stack,
    );
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      requestId,
    });
  }
}
