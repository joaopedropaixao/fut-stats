import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { Icon } from '../../components/ui/icons';
import { Switch } from '../../components/ui/switch';
import { IosInstallSheet } from './ios-install-sheet';
import { PwaCard } from './pwa-card';
import type { PushTestStatus, UsePush } from './use-push';
import { usePush } from './use-push';

const TEST_TEXT: Record<Exclude<PushTestStatus, 'idle' | 'sending'>, string> = {
  sent: 'Aviso enviado. Deve chegar em instantes.',
  'not-registered': 'Este celular ainda não está registrado. Desligue e ligue os avisos.',
  error: 'Não deu para enviar o teste. Tente de novo.',
};

const FAILED_TEXT: Record<NonNullable<UsePush['failed']>, string> = {
  enable: 'Não deu para ativar agora. Tente de novo.',
  'enable-timeout': 'O navegador demorou para ligar os avisos. Tente de novo.',
  disable: 'Não deu para desativar agora. Tente de novo.',
};

const PENDING_TEXT = { enable: 'Ligando…', disable: 'Desligando…', none: undefined } as const;

const BELL_MARK = (
  <span className="inline-flex size-14 shrink-0 items-center justify-center bg-bg text-text shadow-[inset_0_0_0_2px_var(--color-border-strong)]">
    <Icon name="bell" size={32} />
  </span>
);

/**
 * "Avisos" (Perfil): liga e desliga os avisos deste celular. A permissão só é pedida no toque do interruptor;
 * bloqueado, sem suporte e iPhone sem instalar dizem o motivo. Com o servidor sem push, o card não aparece.
 */
export function PushCard({ delay = 0 }: { delay?: number }) {
  const push = usePush({ sync: true });
  const [sheetOpen, setSheetOpen] = useState(false);
  const { state } = push;
  if (state === 'hidden') return null;

  return (
    <>
      <PwaCard title="Avisos" mark={BELL_MARK} delay={delay}>
        {state === 'unsupported' && (
          <p className="text-base text-text-muted">Este navegador não recebe avisos.</p>
        )}
        {state === 'ios-install' && (
          <>
            <p className="text-base text-text-muted">
              No iPhone, os avisos só funcionam com o app instalado.
            </p>
            <Button
              label="Instalar"
              icon="phone"
              variant="outline"
              size={48}
              block
              onClick={() => setSheetOpen(true)}
            />
          </>
        )}
        {(state === 'checking' || state === 'off' || state === 'on' || state === 'blocked') && (
          <>
            <Switch
              className="px-0! py-0!"
              label="Avisos neste celular"
              checked={state === 'on'}
              loading={push.busy || state === 'checking'}
              loadingLabel={PENDING_TEXT[push.pending ?? 'none']}
              disabled={state === 'blocked'}
              hint={
                state === 'blocked'
                  ? 'Você bloqueou os avisos. Libere nas configurações do navegador.'
                  : undefined
              }
              onCheckedChange={(on) => (on ? push.enable() : push.disable())}
            />
            <p className="text-base text-text-muted">Rodada marcada, times, votação e resultado.</p>
            {push.failed && (
              <p role="alert" className="text-sm text-[#fca5a5]">
                {FAILED_TEXT[push.failed]}
              </p>
            )}
            {state === 'on' && (
              <div className="flex flex-col gap-2">
                <Button
                  label="Testar aviso"
                  icon="bell"
                  variant="outline"
                  size={48}
                  block
                  loading={push.testStatus === 'sending'}
                  onClick={push.sendTest}
                />
                {push.testStatus !== 'idle' && push.testStatus !== 'sending' && (
                  <p
                    role={push.testStatus === 'sent' ? 'status' : 'alert'}
                    className="text-sm text-text-muted"
                  >
                    {TEST_TEXT[push.testStatus]}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </PwaCard>
      {sheetOpen && <IosInstallSheet onClose={() => setSheetOpen(false)} />}
    </>
  );
}
