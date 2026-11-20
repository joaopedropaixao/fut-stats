import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import '@fontsource/silkscreen/latin-400.css';
import { WaitNotice } from '../components/ui/wait-notice';
import { cn } from '../lib/cn';
import { useSlowWait } from '../lib/slow-wait';
import { restartQuery, SERVER_WAIT, SERVER_WAIT_BALL, serverWaitView } from './server-wait-view';

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
const SCALE = 6;

/**
 * A bola pixel de 72 px com a sombra de dois degraus (32 e 48 px). Quicando, em degraus, a sombra encolhe quando ela
 * sobe e fica separada embaixo; parada (`still`, ou Reduzir movimento) a bola fica no chão e a sombra, colada nela.
 */
function Ball({ still }: { still?: boolean }) {
  return (
    <div
      aria-hidden
      className={cn(
        'relative flex w-[72px] flex-col items-center justify-end',
        still ? 'h-[84px]' : 'h-[124px]',
      )}
    >
      <svg
        focusable="false"
        width={BALL[0].length * SCALE}
        height={BALL.length * SCALE}
        viewBox={`0 0 ${BALL[0].length} ${BALL.length}`}
        shapeRendering="crispEdges"
        className={still ? undefined : 'animate-ball-bounce motion-reduce:animate-none'}
      >
        {BALL_PATHS.map(([color, d]) => (
          <path key={color} d={d} fill={color} />
        ))}
      </svg>
      <svg
        focusable="false"
        width={72}
        height={8}
        viewBox="0 0 18 2"
        shapeRendering="crispEdges"
        className={cn('mt-1', !still && 'animate-ball-shadow motion-reduce:animate-none')}
      >
        <path d="M5 0h8v1h-8zM3 1h12v1h-12z" fill="var(--color-outline)" opacity="0.45" />
      </svg>
    </div>
  );
}

/**
 * O fundo do desenho da tela de servidor: verde-escuro com um radial mais claro no centro. A tela cobre a janela
 * inteira (sem barra de abas).
 */
const SERVER_BG =
  'min-h-dvh w-full bg-[radial-gradient(ellipse_75%_55%_at_50%_52%,#2e4531_0%,#1a3322_100%)]';

/** Título pixel em Silkscreen regular (o desenho usa o peso 400, mais estreito que o 700 do resto do app). */
function ServerTitle({ children, className }: { children: string; className?: string }) {
  return (
    <h1
      style={{ fontWeight: 400 }}
      className={cn('pixel text-pixel-md tracking-[0.01em] text-text', className)}
    >
      {children}
    </h1>
  );
}

/**
 * Tela cheia "Servidor iniciando...": a bola quica, uma frase de calma e, depois de 10 s, o aviso do 1 min. O título
 * cabe em uma linha de 375 px para cima; abaixo de 360 px ele diminui (16 px) em vez de quebrar.
 */
export function ServerStarting({ notice, focus }: { notice: boolean; focus?: boolean }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (focus) ref.current?.focus();
  }, [focus]);
  return (
    <div className={SERVER_BG}>
      <main
        ref={ref}
        tabIndex={-1}
        className="mx-auto flex min-h-dvh max-w-content flex-col items-center justify-center px-4 pt-16 pb-10 text-center outline-none"
      >
        <title>Servidor iniciando · Fut Stats</title>
        <div role="status" className="flex flex-col items-center gap-[26px]">
          <Ball />
          <div className="flex flex-col items-center gap-2.5">
            <ServerTitle className="whitespace-nowrap max-[359px]:text-pixel-sm">
              Servidor iniciando...
            </ServerTitle>
            <p className="text-[15px] leading-5 text-text-muted">Já já a pelada abre.</p>
          </div>
        </div>
        {/* A região existe sempre: o leitor de tela só anuncia o que entra depois dela */}
        <div aria-live="polite" className="mt-7 flex w-full justify-center">
          {notice && (
            <WaitNotice className="max-w-full">Pode levar até 1 min na primeira vez</WaitNotice>
          )}
        </div>
      </main>
    </div>
  );
}

/**
 * O servidor não respondeu (desenho 3c): a bola parada no chão em cima de um cartão com borda `danger`, o título
 * pixel, a explicação e a tecla creme "Tentar de novo" (que refaz o pedido, uma vez por toque).
 */
export function ServerNotResponding({ onRetry }: { onRetry: () => void }) {
  return (
    <div className={SERVER_BG}>
      <main className="mx-auto flex min-h-dvh max-w-content flex-col items-center justify-center gap-6 px-4 pt-[112px] pb-10">
        <title>O servidor não respondeu · Fut Stats</title>
        <Ball still />
        <div
          role="alert"
          className="flex w-full flex-col gap-3.5 border-[3px] border-danger bg-surface-raised p-5 shadow-[4px_4px_0_var(--color-outline)]"
        >
          <ServerTitle>O servidor não respondeu</ServerTitle>
          <p className="text-[15px] leading-[1.45] text-text-muted">
            Pode ser a internet ou o servidor ainda acordando. Tente de novo em instantes.
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="flex min-h-13 w-full items-center justify-center border-[3px] border-outline bg-text px-4 text-team-black shadow-[4px_4px_0_var(--color-outline)] select-none active:translate-x-1 active:translate-y-1 active:shadow-none"
          >
            <span style={{ fontWeight: 400 }} className="pixel text-pixel-sm tracking-[0.08em]">
              Tentar de novo
            </span>
          </button>
        </div>
      </main>
    </div>
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

/**
 * `ServerWait` ligado a uma consulta (a sessão, a prévia do convite): a falha é `errorUpdateCount` (depois das
 * retentativas), e "Tentar de novo" refaz o pedido com `refetch()`, uma vez por toque, e remonta a espera para os
 * temporizadores recomeçarem. O erro já visto não volta enquanto não houver outra falha.
 */
export function QueryServerWait({
  query,
  queryKey,
  skeleton,
}: {
  query: { errorUpdateCount: number; refetch: () => unknown };
  /** A chave da consulta: "Tentar de novo" cancela o pedido pendurado antes de refazer (`restartQuery`). */
  queryKey: QueryKey;
  skeleton: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [attempt, setAttempt] = useState(0);
  const [seenErrors, setSeenErrors] = useState(0);
  return (
    <ServerWait
      key={attempt}
      failed={query.errorUpdateCount > seenErrors}
      retried={attempt > 0}
      onRetry={() => {
        setSeenErrors(query.errorUpdateCount);
        setAttempt((n) => n + 1);
        void restartQuery(queryClient, queryKey, () => query.refetch());
      }}
      skeleton={skeleton}
    />
  );
}
