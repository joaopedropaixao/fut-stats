import { QueryClient } from '@tanstack/react-query';
import { ApiContractError, ApiError } from './api';

/** Repetir só vale para falha de rede ou 5xx: erro 4xx e contrato quebrado não mudam tentando de novo. */
function shouldRetry(failureCount: number, error: Error): boolean {
  if (error instanceof ApiContractError) return false;
  if (error instanceof ApiError && error.status < 500) return false;
  return failureCount < 2;
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetry, refetchOnWindowFocus: false },
    },
  });
}
