import { useEffect, useState, type ComponentType } from 'react';

/**
 * Monta o `LiveRounds` depois da primeira tela. O canal pesa (schemas, consultas) e não é preciso para abrir o app:
 * o `import()` mantém tudo isso fora do JS inicial. Se o pedaço não vier (rede, versão velha), o app segue no modo
 * antigo e a pessoa não vê nada.
 */
export function LiveRoundsMount() {
  const [Live, setLive] = useState<ComponentType | null>(null);

  useEffect(() => {
    let active = true;
    import('./live-rounds')
      .then((module) => {
        if (active) setLive(() => module.LiveRounds);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  return Live ? <Live /> : null;
}
