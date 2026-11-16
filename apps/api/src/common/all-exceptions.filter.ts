import { HttpException, HttpStatus, Logger, type ArgumentsHost } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { Request, Response } from 'express';
import { getRequestId } from './request-context';

/** Erro de HTTP que não é `HttpException` (ex.: corpo grande demais no body-parser): o Nest trata como o status dele. */
function isHttpError(exception: unknown): boolean {
  const { statusCode, message } = (exception ?? {}) as { statusCode?: unknown; message?: unknown };
  return typeof statusCode === 'number' && typeof message === 'string';
}

/**
 * Filtro global. O que o Nest já sabe responder (`HttpException`, erros de HTTP) segue como sempre. O resto é
 * 500: loga o erro com a pilha e o `requestId`, e responde `{ statusCode, message, requestId }` sem a pilha.
 */
export class AllExceptionsFilter extends BaseExceptionFilter {
  private readonly errorLogger = new Logger('Exceptions');

  override catch(exception: unknown, host: ArgumentsHost): void {
    if (exception instanceof HttpException || isHttpError(exception)) {
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
