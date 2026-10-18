import { healthResponseSchema, type HealthResponse } from '@fut-stats/shared';
import { useEffect, useState } from 'react';

type ApiState =
  { kind: 'loading' } | { kind: 'ok'; data: HealthResponse } | { kind: 'error'; message: string };

async function fetchHealth(signal: AbortSignal): Promise<HealthResponse> {
  const res = await fetch('/api/health', { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const parsed = healthResponseSchema.safeParse(await res.json());
  if (!parsed.success) throw new Error('resposta inesperada da API');
  return parsed.data;
}

export function App() {
  const [api, setApi] = useState<ApiState>({ kind: 'loading' });

  useEffect(() => {
    // Cancela a requisição se o componente sair da tela antes da resposta
    const controller = new AbortController();

    fetchHealth(controller.signal)
      .then((data) => setApi({ kind: 'ok', data }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setApi({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
      });

    return () => controller.abort();
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
      <h1 className="text-4xl font-bold">Fut Stats</h1>
      <p>
        API: {api.kind === 'loading' && <span>verificando...</span>}
        {api.kind === 'ok' && <span className="font-mono">{api.data.status}</span>}
        {api.kind === 'error' && <span className="font-mono">erro ({api.message})</span>}
      </p>
    </main>
  );
}
