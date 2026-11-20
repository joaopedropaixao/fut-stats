import { useEffect, useRef, type ReactNode } from 'react';
import { PixelText } from '../components/ui/pixel-text';
import { ErrorState } from '../components/ui/states';
import { WaitNotice } from '../components/ui/wait-notice';
import { useSlowWait } from '../lib/slow-wait';
import { SERVER_WAIT, SERVER_WAIT_BALL, serverWaitView } from './server-wait-view';

const BALL = SERVER_WAIT_BALL;
const BALL_FILL: Record<string, string> = { K: '#111111', W: 'var(--color-text)' };

/** Uma cor por caminho: junta os pixels vizinhos da mesma cor numa linha em um retângulo só. */
const BALL_PATHS = Object.entries(
  BALL.reduce<Record<string, string>>((byColor, line, y) => {
    for (let x = 0; x < line.length;) {
      const key = line[x]!;
      let end = x;
      while (end < line.length && line[end] === key) end += 1;
      const color = BALL_FILL[key];
      if (color) byColor[color] = `${byColor[color] ?? ''}M${x} ${y}h${end - x}v1h-${end - x}z`;
      x = end;
    }
    return byColor;
  }, {}),
);
const SCALE = 5;

/** A bola pixel quicando em degraus, com a sombra no chão. Com Reduzir movimento fica parada no chão. */
function BouncingBall() {
  return (
    <div aria-hidden className="relative flex h-[116px] w-[60px] flex-col items-center justify-end">
      <svg
        focusable="false"
        width={BALL[0].length * SCALE}
        height={BALL.length * SCALE}
        viewBox={`0 0 ${BALL[0].length} ${BALL.length}`}
        shapeRendering="crispEdges"
        className="animate-ball-bounce motion-reduce:animate-none"
      >
        {BALL_PATHS.map(([color, d]) => (
          <path key={color} d={d} fill={color} />
        ))}
      </svg>
      <svg
        focusable="false"
        width={BALL[0].length * SCALE}
        height={2 * SCALE}
        viewBox="0 0 12 2"
        shapeRendering="crispEdges"
        className="animate-ball-shadow mt-1 motion-reduce:animate-none"
      >
        <path d="M2 0h8v1h-8zM0 1h12v1h-12z" fill="var(--color-outline)" opacity="0.45" />
      </svg>
    </div>
  );
}

/** Tela cheia "Servidor iniciando...": a bola quica, uma frase de calma e, depois de 10 s, o aviso do 1 min. */
export function ServerStarting({ notice, focus }: { notice: boolean; focus?: boolean }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (focus) ref.current?.focus();
  }, [focus]);
  return (
    <main
      ref={ref}
      tabIndex={-1}
      role="status"
      className="mx-auto flex min-h-dvh max-w-content flex-col items-center justify-center gap-6 px-4 py-10 text-center outline-none"
    >
      <title>Servidor iniciando · Fut Stats</title>
      <BouncingBall />
      <div className="flex flex-col items-center gap-2">
        <PixelText as="h1" size={24} wrap>
          Servidor iniciando...
        </PixelText>
        <p className="text-base text-text-muted">Já já a pelada abre.</p>
      </div>
      {/* A região existe sempre: o leitor de tela só anuncia o que entra depois dela */}
      <div aria-live="polite" className="w-full max-w-[22rem]">
        {notice && <WaitNotice>Pode levar até 1 min na primeira vez</WaitNotice>}
      </div>
    </main>
  );
}

/** O servidor não respondeu: tela de erro com "Tentar de novo" (que refaz o pedido, uma vez por toque). */
export function ServerNotResponding({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-content flex-col justify-center px-4 py-10">
      <title>O servidor não respondeu · Fut Stats</title>
      <ErrorState
        screen
        title="O servidor não respondeu"
        message="Pode ser a internet ou o servidor ainda acordando. Tente de novo em instantes."
        onRetry={onRetry}
      />
    </main>
  );
}

/**
 * A espera do primeiro `/me`: esqueleto (`skeleton`, que vem pronto de quem chama, dentro da moldura do app), tela de
 * servidor iniciando e erro. Quem chama põe `key={tentativa}`: tocar em "Tentar de novo" remonta isto e os
 * temporizadores recomeçam do zero.
 */
export function ServerWait({
  failed,
  retried,
  onRetry,
  skeleton,
}: {
  failed: boolean;
  retried: boolean;
  onRetry: () => void;
  skeleton: ReactNode;
}) {
  const waiting = !failed;
  const startingElapsed = useSlowWait(waiting, SERVER_WAIT.startingAfter);
  const noticeElapsed = useSlowWait(waiting, SERVER_WAIT.noticeAfter);
  const gaveUp = useSlowWait(waiting, SERVER_WAIT.giveUpAfter);
  const view = serverWaitView({ failed, gaveUp, startingElapsed, retried });
  if (view === 'error') return <ServerNotResponding onRetry={onRetry} />;
  if (view === 'starting') return <ServerStarting notice={noticeElapsed} focus={retried} />;
  return skeleton;
}
