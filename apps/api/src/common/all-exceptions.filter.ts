import { HttpException, HttpStatus, Logger, type ArgumentsHost } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { Request, Response } from 'express';
import { captureServerError } from './monitoring';
import { annotateRequestContext, getRequestContext, getRequestId } from './request-context';

/** Só no log de pedido: o corpo do 400 de validação não ganha campo novo. */
const VALIDATION_ERROR_CODE = 'VALIDATION_FAILED';

/**
 * Status de um erro de HTTP que não é `HttpException` (ex.: corpo grande demais no body-parser), que o Nest trata
 * como o status dele; `undefined` se não é um erro desses.
 */
function httpErrorStatus(exception: unknown): number | undefined {
  const { statusCode, message } = (exception ?? {}) as { statusCode?: unknown; message?: unknown };
  return typeof statusCode === 'number' && typeof message === 'string' ? statusCode : undefined;
}

/** Código do erro para o log de pedido: o `code` do corpo (ex.: `NOT_OWN_COMMENT`); validação do Zod = `VALIDATION_FAILED`. */
export function errorCodeOf(exception: HttpException): string | undefined {
  const body = exception.getResponse();
  if (typeof body !== 'object' || body === null) return undefined;
  const { code, issues } = body as { code?: unknown; issues?: unknown };
  if (typeof code === 'string' && code.length > 0) return code;
  return Array.isArray(issues) ? VALIDATION_ERROR_CODE : undefined;
}

/** Manda para o Sentry (se ligado) com o que o contexto do pedido sabe: `requestId`, grupo e usuário. */
function reportToMonitoring(exception: unknown): void {
  const context = getRequestContext();
  captureServerError(exception, {
    requestId: context?.requestId ?? null,
    groupId: context?.groupId,
    userId: context?.userId,
  });
}

/**
 * Filtro global. O que o Nest já sabe responder (`HttpException`, erros de HTTP) segue como sempre. O resto é
 * 500: loga o erro com a pilha e o `requestId`, e responde `{ statusCode, message, requestId }` sem a pilha.
 * Só o 500 e qualquer resposta de status >= 500 vão para o Sentry; erro de regra (4xx) não.
 */
export class AllExceptionsFilter extends BaseExceptionFilter {
  private readonly errorLogger = new Logger('Exceptions');

  override catch(exception: unknown, host: ArgumentsHost): void {
    const status =
      exception instanceof HttpException ? exception.getStatus() : httpErrorStatus(exception);
    if (status !== undefined) {
      if (exception instanceof HttpException) {
        const errorCode = errorCodeOf(exception);
        if (errorCode) annotateRequestContext({ errorCode });
      }
      if (status >= 500) reportToMonitoring(exception);
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
    reportToMonitoring(error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      requestId,
    });
  }
}
