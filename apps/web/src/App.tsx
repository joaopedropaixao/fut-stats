import { healthResponseSchema, type HealthResponse } from '@fut-stats/shared';
import { useEffect, useState } from 'react';

type ApiState =
  { kind: 'loading' } | { kind: 'ok'; data: HealthResponse } | { kind: 'error'; message: string };

export function App() {
  const [api, setApi] = useState<ApiState>({ kind: 'loading' });

  useEffect(() => {
    fetch('/api/health')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((body) => setApi({ kind: 'ok', data: healthResponseSchema.parse(body) }))
      .catch((err: unknown) =>
        setApi({ kind: 'error', message: err instanceof Error ? err.message : String(err) }),
      );
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
